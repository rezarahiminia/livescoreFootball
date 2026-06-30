const axios = require('axios');
const crypto = require('crypto');
const Donation = require('../models/donation');

// NOWPayments Configuration - loaded from environment variables
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';
const DONATION_WALLET = process.env.DONATION_WALLET_ADDRESS;

// Wallet addresses per network
const WALLET_ADDRESSES = {
    trc20: 'TH1cqV6bmZcmtV3SWDtH1N1roCEcAGpB7V',
    bep20: '0xD492E850a67346b96C1F6107CC06E3132aAEec9A',
    erc20: '0xD492E850a67346b96C1F6107CC06E3132aAEec9A'
};

const NETWORK_CURRENCIES = {
    trc20: 'usdttrc20',
    bep20: 'usdtbsc',
    erc20: 'usdterc20'
};

// Check if running in development/sandbox mode
const IS_DEV = process.env.NODE_ENV !== 'production';

// Helper: Generate unique order ID
const generateOrderId = () => {
    return `DON-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// Helper: Verify IPN signature
const verifyIpnSignature = (payload, signature) => {
    const sortedPayload = Object.keys(payload)
        .sort()
        .reduce((acc, key) => {
            acc[key] = payload[key];
            return acc;
        }, {});
    
    const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
    hmac.update(JSON.stringify(sortedPayload));
    const calculatedSignature = hmac.digest('hex');
    
    return calculatedSignature === signature;
};

module.exports = (app) => {
    
    /**
     * @swagger
     * /donate/create:
     *   post:
     *     summary: Create a new crypto donation
     *     description: Creates a payment via NOWPayments gateway. Users can donate 1-100 USD using USDT (TRC20).
     *     tags: [Donation]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - amount
     *             properties:
     *               amount:
     *                 type: number
     *                 minimum: 10
     *                 maximum: 100
     *                 description: Donation amount in USD
     *                 example: 10
     *               donor_name:
     *                 type: string
     *                 description: Donor name (optional)
     *                 example: "John Doe"
     *               donor_email:
     *                 type: string
     *                 format: email
     *                 description: Donor email (optional)
     *               message:
     *                 type: string
     *                 description: Donor message (optional)
     *     responses:
     *       200:
     *         description: Payment created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 payment_id:
     *                   type: string
     *                 pay_address:
     *                   type: string
     *                   description: Wallet address to send USDT to
     *                 pay_amount:
     *                   type: number
     *                 pay_currency:
     *                   type: string
     *                 order_id:
     *                   type: string
     *                 expires_at:
     *                   type: string
     *       400:
     *         description: Invalid amount (must be 1-100 USD)
     *       500:
     *         description: Payment gateway error
     */
    app.post('/donate/create', async (req, res) => {
        try {
            const { amount, network, donor_name, donor_email, message } = req.body;
            
            // Validate amount
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum < 5 || amountNum > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Amount must be between 5 and 100 USD'
                });
            }
            
            // Validate and resolve network
            const selectedNetwork = ['trc20', 'bep20', 'erc20'].includes(network) ? network : 'trc20';
            const walletAddress = WALLET_ADDRESSES[selectedNetwork];
            const payCurrency = NETWORK_CURRENCIES[selectedNetwork];
            
            const orderId = generateOrderId();
            
            // In development mode, use demo data (NOWPayments requires public URL for callbacks)
            if (IS_DEV) {
                console.log('🧪 DEV MODE: Creating demo donation payment');
                
                // Save demo donation to database
                const donation = new Donation({
                    payment_id: `demo_${Date.now()}`,
                    order_id: orderId,
                    donor_name: donor_name || 'Anonymous',
                    donor_email: donor_email,
                    donor_message: message,
                    amount_usd: amountNum,
                    pay_currency: payCurrency,
                    pay_amount: amountNum,
                    pay_address: walletAddress,
                    status: 'waiting'
                });
                
                await donation.save();
                
                return res.json({
                    success: true,
                    payment_id: donation.payment_id,
                    pay_address: walletAddress,
                    pay_amount: amountNum,
                    pay_currency: payCurrency,
                    order_id: orderId,
                    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
                    demo_mode: true
                });
            }
            
            // Production: Create payment with NOWPayments
            // Add small buffer to avoid "less than minimal" error from gateway fees
            const gatewayAmount = Math.max(amountNum * 1.005, amountNum + 0.05);
            const paymentResponse = await axios.post(
                `${NOWPAYMENTS_API}/payment`,
                {
                    price_amount: parseFloat(gatewayAmount.toFixed(2)),
                    price_currency: 'usd',
                    pay_currency: payCurrency,
                    order_id: orderId,
                    order_description: `Donation to FIFA World Cup 2026 Project - $${amountNum}`,
                    ipn_callback_url: `${req.protocol}://${req.get('host')}/donate/ipn`,
                    success_url: `${req.protocol}://${req.get('host')}/?donation=success`,
                    cancel_url: `${req.protocol}://${req.get('host')}/?donation=cancelled`
                },
                {
                    headers: {
                        'x-api-key': NOWPAYMENTS_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const paymentData = paymentResponse.data;
            
            // Save donation to database
            const donation = new Donation({
                payment_id: paymentData.payment_id,
                order_id: orderId,
                donor_name: donor_name || 'Anonymous',
                donor_email: donor_email,
                donor_message: message,
                amount_usd: amountNum,
                pay_currency: paymentData.pay_currency,
                pay_amount: paymentData.pay_amount,
                pay_address: paymentData.pay_address,
                status: paymentData.payment_status || 'waiting'
            });
            
            await donation.save();
            
            res.json({
                success: true,
                payment_id: paymentData.payment_id,
                pay_address: paymentData.pay_address,
                pay_amount: paymentData.pay_amount,
                pay_currency: paymentData.pay_currency,
                order_id: orderId,
                expires_at: paymentData.expiration_estimate_date
            });
            
        } catch (error) {
            console.error('Create donation error:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                error: error.response?.data?.message || 'Failed to create payment'
            });
        }
    });
    
    /**
     * @swagger
     * /donate/ipn:
     *   post:
     *     summary: IPN Callback from NOWPayments
     *     description: Receives payment status updates from NOWPayments. Do not call this endpoint manually.
     *     tags: [Donation]
     *     security: []
     *     responses:
     *       200:
     *         description: IPN processed successfully
     *       400:
     *         description: Invalid signature
     *       404:
     *         description: Donation not found
     */
    app.post('/donate/ipn', async (req, res) => {
        try {
            const payload = req.body;
            const signature = req.headers['x-nowpayments-sig'];
            
            console.log('📥 IPN Received:', JSON.stringify(payload, null, 2));
            
            // Verify signature — NOWPayments always sends x-nowpayments-sig on real
            // IPN callbacks. Reject any request that is missing the header or whose
            // HMAC does not match, otherwise an unauthenticated attacker can forge
            // payment confirmations by simply omitting the header.
            if (!NOWPAYMENTS_IPN_SECRET) {
                console.error('❌ IPN rejected: NOWPAYMENTS_IPN_SECRET is not configured');
                return res.status(500).json({ error: 'IPN verification not configured' });
            }
            if (!signature || !verifyIpnSignature(payload, signature)) {
                console.error('❌ Invalid or missing IPN signature');
                return res.status(400).json({ error: 'Invalid signature' });
            }
            
            // Validate id fields are plain strings before querying.
            // Mongo/Mongoose treats nested objects (e.g. {"$ne": null}) as
            // operator expressions, which would let an attacker turn the
            // findOne below into a "match anything" query and mark an
            // arbitrary donation as paid (CWE-943, NoSQL injection).
            const paymentIdRaw = payload.payment_id;
            const orderIdRaw   = payload.order_id;
            const paymentId = (typeof paymentIdRaw === 'string') ? paymentIdRaw : null;
            const orderId   = (typeof orderIdRaw   === 'string') ? orderIdRaw   : null;

            if (!paymentId && !orderId) {
                console.error('❌ IPN missing string payment_id/order_id');
                return res.status(400).json({ error: 'Invalid payload' });
            }

            // Build a filter that only contains the ids that are valid strings.
            const orClauses = [];
            if (paymentId) orClauses.push({ payment_id: paymentId });
            if (orderId)   orClauses.push({ order_id:   orderId   });

            // Find and update donation
            const donation = await Donation.findOne({ $or: orClauses });
            
            if (!donation) {
                console.error('❌ Donation not found:', payload.order_id);
                return res.status(404).json({ error: 'Donation not found' });
            }
            
            // Update donation status
            donation.status = payload.payment_status;
            donation.actually_paid = payload.actually_paid;
            donation.updated_at = new Date();
            
            if (payload.payment_status === 'finished' || payload.payment_status === 'confirmed') {
                donation.paid_at = new Date();
            }
            
            await donation.save();
            
            console.log(`✅ Donation ${donation.order_id} updated: ${payload.payment_status}`);
            
            res.json({ success: true });
            
        } catch (error) {
            console.error('IPN Error:', error);
            res.status(500).json({ error: 'IPN processing failed' });
        }
    });
    
    /**
     * @swagger
     * /donate/status/{orderId}:
     *   get:
     *     summary: Check donation payment status
     *     description: Returns the current status of a donation by order ID
     *     tags: [Donation]
     *     security: []
     *     parameters:
     *       - in: path
     *         name: orderId
     *         required: true
     *         schema:
     *           type: string
     *         description: The donation order ID (e.g. DON-1234567890-ABCDEFG)
     *     responses:
     *       200:
     *         description: Donation status returned
     *       404:
     *         description: Donation not found
     */
    app.get('/donate/status/:orderId', async (req, res) => {
        try {
            const donation = await Donation.findOne({ order_id: req.params.orderId })
                .select('-__v')
                .lean();
            
            if (!donation) {
                return res.status(404).json({
                    success: false,
                    error: 'Donation not found'
                });
            }
            
            res.json({
                success: true,
                donation: {
                    order_id: donation.order_id,
                    amount_usd: donation.amount_usd,
                    status: donation.status,
                    donor_name: donation.donor_name,
                    created_at: donation.created_at,
                    paid_at: donation.paid_at
                }
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get donation status'
            });
        }
    });
    
    /**
     * @swagger
     * /donate/recent:
     *   get:
     *     summary: Get recent successful donations
     *     description: Returns the 10 most recent confirmed donations and total stats
     *     tags: [Donation]
     *     security: []
     *     responses:
     *       200:
     *         description: List of recent donations with stats
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 donations:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       name:
     *                         type: string
     *                       amount:
     *                         type: number
     *                       message:
     *                         type: string
     *                       date:
     *                         type: string
     *                 stats:
     *                   type: object
     *                   properties:
     *                     total_amount:
     *                       type: number
     *                     total_donations:
     *                       type: number
     */
    app.get('/donate/recent', async (req, res) => {
        try {
            const donations = await Donation.find({
                status: { $in: ['finished', 'confirmed'] }
            })
            .select('donor_name amount_usd donor_message created_at')
            .sort({ created_at: -1 })
            .limit(10)
            .lean();
            
            // Calculate total
            const totalResult = await Donation.aggregate([
                { $match: { status: { $in: ['finished', 'confirmed'] } } },
                { $group: { _id: null, total: { $sum: '$amount_usd' }, count: { $sum: 1 } } }
            ]);
            
            const total = totalResult[0] || { total: 0, count: 0 };
            
            res.json({
                success: true,
                donations: donations.map(d => ({
                    name: d.donor_name || 'Anonymous',
                    amount: d.amount_usd,
                    message: d.donor_message,
                    date: d.created_at
                })),
                stats: {
                    total_amount: total.total,
                    total_donations: total.count
                }
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get donations'
            });
        }
    });
    
    /**
     * @swagger
     * /donate/currencies:
     *   get:
     *     summary: Get available donation currencies
     *     description: Returns the list of supported cryptocurrencies for donations
     *     tags: [Donation]
     *     security: []
     *     responses:
     *       200:
     *         description: Available currencies list
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 currencies:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       code:
     *                         type: string
     *                         example: usdttrc20
     *                       name:
     *                         type: string
     *                         example: USDT (TRC20)
     *                       network:
     *                         type: string
     *                         example: TRON
     *                       min_amount:
     *                         type: number
     *                         example: 1
     */
    app.get('/donate/currencies', async (req, res) => {
        // For now, we only support USDT-TRC20
        res.json({
            success: true,
            currencies: [
                {
                    code: 'usdttrc20',
                    name: 'USDT (TRC20)',
                    network: 'TRON',
                    min_amount: 10,
                    description: 'Tether USD on TRON network - Fast & Low fees'
                }
            ]
        });
    });
};
