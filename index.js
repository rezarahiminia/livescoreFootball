// Load environment configuration
const { loadEnvConfig, config } = require('./config/env');
const nodeEnv = loadEnvConfig();

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');

// Catch unhandled errors
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    console.error(err.stack);
    // Don't exit in dev
    // if (config.isProd) process.exit(1);
});
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    console.error(err.stack);
    // Don't exit in dev
    // if (config.isProd) process.exit(1);
});

const app = express();
const PORT = config.PORT;

// Trust proxy - MUST be set when behind nginx/reverse proxy
// Fixes: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Swagger setup (only in development or if explicitly enabled)
let swaggerUi, specs;
console.log(`🔍 ENABLE_SWAGGER value: ${config.ENABLE_SWAGGER}`);
if (config.ENABLE_SWAGGER) {
    try {
        const swagger = require('./swagger');
        swaggerUi = swagger.swaggerUi;
        specs = swagger.specs;
        console.log(`✅ Swagger loaded: swaggerUi=${!!swaggerUi}, specs=${!!specs}`);
    } catch(err) {
        console.error('❌ Swagger failed to load:', err.message);
    }
} else {
    console.log('⚠️ Swagger is disabled');
}

// CORS - public read endpoints must be reachable from browsers on other origins
const corsOrigins = config.getCorsOrigins();
const publicCorsOptions = {
    origin: corsOrigins,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: false
};
app.use(cors(publicCorsOptions));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Compression for faster responses
app.use(compression());

// Rate limiting - configurable per environment
const baseLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT_MAX,
    message: {
        error: 'Too many requests, please try again later.',
        retryAfter: `${Math.ceil(config.RATE_LIMIT_WINDOW / 1000)} seconds`
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
});
const publicGetLimiter = rateLimit({
    windowMs: config.PUBLIC_RATE_LIMIT_WINDOW,
    max: config.PUBLIC_RATE_LIMIT_MAX,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: `${Math.ceil(config.PUBLIC_RATE_LIMIT_WINDOW / 1000)} seconds`
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
});
app.use((req, res, next) => {
    if (req.path.startsWith('/get')) {
        return publicGetLimiter(req, res, next);
    }

    return baseLimiter(req, res, next);
});

// Logging
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms', {
    skip: (req, res) => config.isProd && res.statusCode < 400
}));

if (config.LOG_LEVEL === 'debug') {
    // Request logger - useful locally, too noisy under production traffic
    app.use((req, res, next) => {
        const start = Date.now();
        console.log(`📥 ${req.method} ${req.url} from ${req.ip}`);
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            const statusIcon = res.statusCode >= 400 ? '❌' : '✅';
            console.log(`${statusIcon} ${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`);
        });
        
        next();
    });
}

console.log(`🌍 Environment: ${config.NODE_ENV}`);
console.log(`📊 Rate Limit: ${config.RATE_LIMIT_MAX} req/${config.RATE_LIMIT_WINDOW}ms`);
console.log(`📊 Public /get Rate Limit: ${config.PUBLIC_RATE_LIMIT_MAX} req/${config.PUBLIC_RATE_LIMIT_WINDOW}ms`);
console.log(`🔗 CORS Origin: ${typeof corsOrigins === 'string' ? corsOrigins : corsOrigins.join(', ')}`);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10kb' }));

// JSON and health endpoints are useful to clients but should not compete with
// the human-facing league pages in search results.
app.use(['/get', '/health', '/api/health', '/openapi.json', '/service-info.json'], (req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
});

// The HTML file is a server-rendering template, not a public static asset.
app.get('/assets/index.html', (req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    return res.status(404).type('text/plain').send('Not found');
});

app.use('/assets', express.static(path.join(__dirname, 'public'), {
    index: false,
    maxAge: config.isProd ? '7d' : 0
}));

// Swagger Documentation
if (swaggerUi && specs) {
    app.get('/openapi.json', (req, res) => {
        res.set('Cache-Control', 'no-store, max-age=0');
        return res.json(specs);
    });
    app.use('/api-docs', (req, res, next) => {
        res.set('Cache-Control', 'no-store, max-age=0');
        next();
    }, swaggerUi.serve, swaggerUi.setup(null, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Free Football Live Scores API Documentation',
        swaggerOptions: {
            url: '/openapi.json',
            displayRequestDuration: true,
            persistAuthorization: false
        }
    }));
    console.log('📚 Swagger UI available at /api-docs');
} else {
    console.log('⚠️ Swagger NOT mounted! swaggerUi:', !!swaggerUi, 'specs:', !!specs);
}

app.get('/service-info.json', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
        name: 'Free Football Live Scores API',
        version: require('./package.json').version,
        dataSource: 'MongoDB',
        upstreamCalls: false,
        documentation: '/api-docs/',
        openapi: '/openapi.json',
        businessContext: '/business-context.md',
        coverage: '/get/soccer/meta',
        endpoints: {
            leagues: '/get/soccer/leagues',
            scoreboard: '/get/soccer/{league}/scoreboard',
            clubs: '/get/soccer/{league}/clubs',
            standings: '/get/soccer/{league}/standings',
            matchSummary: '/get/soccer/{league}/summary?event={eventId}'
        }
    });
});

app.get('/business-context.md', (req, res) => {
    res.type('text/markdown');
    res.set('Cache-Control', 'public, max-age=300');
    return res.sendFile(path.join(__dirname, 'BUSINESS-CONTEXT.md'));
});

require('./controllers/index')(app);

app.use((req, res, next) => {
    console.log(`⚠️ 404 Not Found: ${req.method} ${req.url} from ${req.ip}`);
    const erro = new Error('Route not found');
    erro.status = 404;
    next(erro);
});

app.use((error, req, res, next) => {
    console.error(`❌ Error ${error.status || 500}: ${error.message} | ${req.method} ${req.url}`);
    if (error.stack) console.error(error.stack);
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'no-store');
    res.status(error.status || 500);
    return res.send({
        error: {
            message: error.message
        }
    })
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
