const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ==================== USUARIOS ====================
let usuariosDB = [
    {
        email: "kiwi@gmail.com",
        password: "123456",
        rol: 0,                    // 0 = Administrador
        secret2FA: null,
        mfaConfigurado: false
    },
    {
        email: "otro@gmail.com",
        password: "123456",
        rol: 1,                    // 1 = Técnico
        secret2FA: null,
        mfaConfigurado: false
    }
];

// ==================== LOGIN ====================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const usuario = usuariosDB.find(u => u.email === email && u.password === password);

    if (usuario) {
        return res.json({
            success: true,
            mfaConfigurado: usuario.mfaConfigurado,
            rol: usuario.rol
        });
    } else {
        return res.status(401).json({
            success: false,
            message: "Correo o contraseña incorrectos"
        });
    }
});

// ==================== GENERAR QR ====================
app.get('/api/setup-2fa', (req, res) => {
    const email = req.query.email;
    const usuario = usuariosDB.find(u => u.email === email);

    if (!usuario) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    if (usuario.mfaConfigurado && usuario.secret2FA) {
        return res.json({ success: true, alreadyConfigured: true });
    }

    const secret = speakeasy.generateSecret({
        name: `MiPractica (${email})`
    });

    usuario.secret2FA = secret.base32;

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Error generando el QR" });
        }
        res.json({ success: true, qrCodeDataUrl: data_url });
    });
});

// ==================== VERIFICAR CÓDIGO 2FA ====================
app.post('/api/verify-2fa', (req, res) => {
    const { email, token } = req.body;

    const usuario = usuariosDB.find(u => u.email === email);

    if (!usuario) {
        return res.status(404).json({ 
            success: false, 
            message: "Usuario no encontrado" 
        });
    }

    if (!usuario.secret2FA) {
        return res.status(400).json({ 
            success: false, 
            message: "Este usuario no tiene 2FA configurado" 
        });
    }

    const verificado = speakeasy.totp.verify({
        secret: usuario.secret2FA,
        encoding: 'base32',
        token: token,
        window: 1
    });

    if (verificado) {
        usuario.mfaConfigurado = true;
        return res.json({ 
            success: true, 
            message: "Autenticación completada",
            rol: usuario.rol 
        });
    } else {
        return res.status(400).json({ 
            success: false, 
            message: "Código de verificación incorrecto" 
        });
    }
});

// ==================== OBTENER PROYECTOS ====================
app.get('/api/proyectos', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'datos.json');
        const proyectos = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(proyectos);
    } catch (error) {
        console.error("Error al leer datos.json:", error);
        res.status(500).json({ success: false, message: "Error al cargar los proyectos" });
    }
});

// ==================== INICIAR SERVIDOR ====================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor backend corriendo en http://localhost:${PORT}`);
});