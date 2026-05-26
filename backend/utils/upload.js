const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function makeStorage(subdir) {
    const dir = path.join(UPLOADS_ROOT, subdir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, dir),
        filename:    (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            cb(null, `${Date.now()}${ext}`);
        },
    });
}

const imageFilter = (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }));
};

exports.qrUpload = multer({
    storage:    makeStorage('qr'),
    fileFilter: imageFilter,
    limits:     { fileSize: 5 * 1024 * 1024 },
});

exports.slipUpload = multer({
    storage:    makeStorage('slips'),
    fileFilter: imageFilter,
    limits:     { fileSize: 10 * 1024 * 1024 },
});

exports.UPLOADS_ROOT = UPLOADS_ROOT;
