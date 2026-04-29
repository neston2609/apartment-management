/**
 * JWT auth middleware.
 *   - authenticate            : verifies token, attaches req.user
 *   - adminOnly               : requires user.role === 'admin'  (any admin sub-role)
 *   - tenantOnly              : requires user.role === 'tenant'
 *   - superAdminOnly          : requires admin with admin_role === 'super_admin'
 *   - requireAdminRoles(...)  : requires admin whose admin_role is in the allowed list
 */
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    return next();
}

function tenantOnly(req, res, next) {
    if (!req.user || req.user.role !== 'tenant') {
        return res.status(403).json({ error: 'Tenant access required' });
    }
    return next();
}

function superAdminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin' || req.user.admin_role !== 'super_admin') {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    return next();
}

function requireAdminRoles(...allowed) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const ar = req.user.admin_role || 'admin';
        if (!allowed.includes(ar)) {
            return res.status(403).json({ error: 'Insufficient role' });
        }
        return next();
    };
}

function signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

module.exports = {
    authenticate, adminOnly, tenantOnly,
    superAdminOnly, requireAdminRoles, signToken,
};
