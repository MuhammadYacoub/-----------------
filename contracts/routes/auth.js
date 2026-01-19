import express from 'express';
import nodemailer from 'nodemailer';
import { getPool, sql } from '../db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123!'; // Use env IRL

const router = express.Router();

// Nodemailer Transporter
// NOTE: For Gmail, use App Password if 2FA is on.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
    try {
        const { email, nationalId, phone } = req.body;

        // Validation
        if (!email || !nationalId || !phone) {
            return res.status(400).json({ success: false, message: 'Missing data' });
        }

        // Generate 6-digit Code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        const pool = await getPool();

        // Save to DB
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('Code', sql.Char(6), code)
            .input('ExpiresAt', sql.DateTime, expiresAt)
            .query(`INSERT INTO OTP_Codes (Email, Code, ExpiresAt) VALUES (@Email, @Code, @ExpiresAt)`);

        // Send Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'رمز التحقق - بوابة التوظيف هيئة قضايا الدولة',
            html: `
                <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #003366; color: #ffffff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 20px;">بوابة التوظيف الإلكترونية</h2>
                        <h3 style="margin: 5px 0 0 0; font-size: 16px; font-weight: normal;">هيئة قضايا الدولة</h3>
                    </div>
                    <div style="padding: 30px; line-height: 1.6;">
                        <p style="font-weight: bold; font-size: 16px;">السيد/ المتقدم الموقر،</p>
                        <p>بناءً على طلبكم لاستكمال إجراءات التسجيل في منظومة التوظيف الإلكترونية لهيئة قضايا الدولة، يرجى استخدام رمز التحقق التالي:</p>
                        
                        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
                            <span style="display: block; font-size: 14px; color: #64748b; margin-bottom: 10px;">رمز التحقق (OTP)</span>
                            <span style="font-family: monospace; font-size: 36px; font-weight: bold; color: #003366; letter-spacing: 8px;">${code}</span>
                        </div>

                        <ul style="font-size: 14px; color: #475569; padding-right: 20px;">
                            <li>هذا الرمز صالح لمدة 10 دقائق فقط من تاريخ الطلب.</li>
                            <li>يرجى عدم مشاركة هذا الرمز مع أي شخص لضمان أمن بياناتكم الشخصية.</li>
                            <li>يعد هذا التحقق خطوة أساسية لاستكمال ملف التقديم الخاص بكم بنجاح.</li>
                        </ul>

                        <p style="margin-top: 25px; font-size: 14px;">مع تمنياتنا لجميع المتقدمين بالتوفيق والسداد.</p>
                    </div>
                    <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="font-size: 11px; color: #94a3b8; margin: 0;">هذه رسالة تلقائية، يرجى عدم الرد عليها.<br>© هيئة قضايا الدولة - جمهورية مصر العربية</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'OTP sent' });

    } catch (err) {
        console.error("OTP Error:", err);
        res.status(500).json({ success: false, message: 'Failed to send OTP: ' + err.message });
    }
});

// 2. Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;
        const pool = await getPool();

        const currentTime = new Date();
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('Code', sql.Char(6), code)
            .input('CurrentTime', sql.DateTime, currentTime)
            .query(`
                SELECT TOP 1 * FROM OTP_Codes 
                WHERE Email = @Email 
                AND Code = @Code 
                AND IsUsed = 0 
                AND ExpiresAt > @CurrentTime
                ORDER BY CreatedAt DESC
            `);

        if (result.recordset.length === 0) {
            return res.json({ success: false, message: 'الرمز غير صحيح أو منتهي الصلاحية' });
        }

        // Mark as used
        const id = result.recordset[0].Id;
        await pool.request()
            .input('Id', sql.Int, id)
            .query('UPDATE OTP_Codes SET IsUsed = 1 WHERE Id = @Id');

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

/* ===============================
   3. APPLICANT LOGIN FLOW
   =============================== */

// A. Initiate Login (Lookup by National ID -> Send OTP to registered Email)
router.post('/applicant/initiate-login', async (req, res) => {
    try {
        const { nationalId } = req.body;

        if (!nationalId) {
            return res.status(400).json({ success: false, message: 'برجاء إدخال الرقم القومي' });
        }

        const pool = await getPool();

        // 1. Find Applicant
        const userCheck = await pool.request()
            .input('NationalId', sql.Char(14), nationalId)
            .query('SELECT TOP 1 Email, FullName FROM Applications WHERE NationalId = @NationalId');

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على طلب تقديم لهذا الرقم القومي' });
        }

        const applicant = userCheck.recordset[0];
        const email = applicant.Email;

        // Validation: Verify Email Exists and is valid
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            console.error(`❌ Invalid or missing email for NationalID: ${nationalId}, Found: '${email}'`);
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني المسجل غير صحيح. برجاء مراجعة الدعم الفني.' });
        }

        // 2. Generate OTP logic (Reuse logic potentially, but for now duplicate for clarity/speed)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // 3. Save OTP
        try {
            await pool.request()
                .input('Email', sql.NVarChar, email)
                .input('Code', sql.Char(6), code)
                .input('ExpiresAt', sql.DateTime, expiresAt)
                .query(`INSERT INTO OTP_Codes (Email, Code, ExpiresAt) VALUES (@Email, @Code, @ExpiresAt)`);
        } catch (dbErr) {
            console.error("❌ OTP DB Error:", dbErr);
            throw new Error('Database Error: Failed to save OTP code.');
        }

        // 4. Send Email
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'رمز الدخول - بوابة التوظيف هيئة قضايا الدولة',
                html: `
                <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #003366; color: #ffffff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 20px;">بوابة التوظيف الإلكترونية</h2>
                        <h3 style="margin: 5px 0 0 0; font-size: 16px; font-weight: normal;">تسجيل الدخول</h3>
                    </div>
                    <div style="padding: 30px; line-height: 1.6;">
                        <p>مرحباً <strong>${applicant.FullName}</strong>،</p>
                        <p>لقد طلبت تسجيل الدخول لمتابعة حالة طلبك. يرجى استخدام الرمز التالي:</p>
                        
                        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
                            <span style="display: block; font-size: 14px; color: #64748b; margin-bottom: 10px;">رمز الدخول (OTP)</span>
                            <span style="font-family: monospace; font-size: 36px; font-weight: bold; color: #003366; letter-spacing: 8px;">${code}</span>
                        </div>
                        <p style="font-size: 12px; color: #666;">تم إرسال هذا الرمز إلى بريدك الإلكتروني المسجل: ${email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}</p>
                    </div>
                </div>
            `
            };
            await transporter.sendMail(mailOptions);
        } catch (emailErr) {
            console.error("❌ Email Send Error:", emailErr);
            throw new Error('Email Error: Failed to send OTP to ' + email);
        }

        // Return masked email to frontend
        const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
        res.json({ success: true, message: 'OTP sent', email: maskedEmail });

    } catch (err) {
        console.error("Login Init Error:", err.message);
        res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// B. Verify Login & Issue Token (Supports BOTH Password and OTP)
router.post('/applicant/login', async (req, res) => {
    try {
        const { nationalId, code, password } = req.body;
        const pool = await getPool();

        // 1. Get user info
        const userCheck = await pool.request()
            .input('NationalId', sql.Char(14), nationalId)
            .query('SELECT TOP 1 Id, Email, FullName, Password FROM Applications WHERE NationalId = @NationalId');

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const applicant = userCheck.recordset[0];
        const hasPassword = !!applicant.Password;

        // 2. Authenticate based on method provided
        if (password) {
            // ===== PASSWORD LOGIN =====
            if (!hasPassword) {
                return res.status(400).json({ success: false, message: 'لم يتم تعيين كلمة مرور. برجاء الدخول بـ OTP أولاً.' });
            }

            const bcrypt = await import('bcryptjs');
            const isMatch = await bcrypt.compare(password, applicant.Password);

            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'كلمة المرور غير صحيحة' });
            }
            // Password is correct, proceed to issue token

        } else if (code) {
            // ===== OTP LOGIN =====
            const currentTime = new Date();
            console.log(`🔍 Verifying OTP for ${applicant.Email}: Code=${code}, Time=${currentTime.toISOString()}`);

            const otpCheck = await pool.request()
                .input('Email', sql.NVarChar, applicant.Email)
                .input('Code', sql.Char(6), code)
                .input('CurrentTime', sql.DateTime, currentTime)
                .query(`
                    SELECT TOP 1 * FROM OTP_Codes 
                    WHERE Email = @Email 
                    AND Code = @Code 
                    AND IsUsed = 0 
                    AND ExpiresAt > @CurrentTime
                `);

            if (otpCheck.recordset.length === 0) {
                const debugCheck = await pool.request()
                    .input('Email', sql.NVarChar, applicant.Email)
                    .query(`SELECT TOP 5 Code, ExpiresAt, IsUsed FROM OTP_Codes WHERE Email = @Email ORDER BY CreatedAt DESC`);
                console.log("❌ OTP Verification Failed. Recent OTPs for user:", debugCheck.recordset);
                return res.status(400).json({ success: false, message: 'الرمز غير صحيح أو منتهي الصلاحية' });
            }

            // Mark OTP used
            const otpRecord = otpCheck.recordset[0];
            const otpId = otpRecord.Id || otpRecord.id || otpRecord.ID;
            if (otpId) {
                const safeId = parseInt(otpId, 10);
                await pool.request().query(`UPDATE OTP_Codes SET IsUsed = 1 WHERE Id = ${safeId}`);
            }
            // OTP is valid, proceed to issue token

        } else {
            return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور أو رمز التحقق' });
        }

        // 3. Issue JWT
        const token = jwt.sign(
            {
                id: applicant.Id,
                nationalId: nationalId,
                role: 'applicant'
            },
            JWT_SECRET,
            { expiresIn: '7d' } // Extended to 7 days for "remember me"
        );

        res.json({
            success: true,
            token,
            fullName: applicant.FullName,
            hasPassword: hasPassword // Tell frontend if password is set
        });

    } catch (err) {
        console.error("Login Verify Error:", err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* ===============================
   C. SET PASSWORD (After Login)
   =============================== */
router.post('/applicant/set-password', async (req, res) => {
    try {
        // 1. Verify Token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }

        const { password, confirmPassword } = req.body;

        // 2. Validate
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'كلمات المرور غير متطابقة' });
        }

        // 3. Hash and Save
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const pool = await getPool();
        const safeUserId = parseInt(user.id, 10);
        await pool.request()
            .query(`UPDATE Applications SET Password = '${hashedPassword}', PasswordSetAt = GETDATE() WHERE Id = ${safeUserId}`);

        res.json({ success: true, message: 'تم تعيين كلمة المرور بنجاح' });

    } catch (err) {
        console.error("Set Password Error:", err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* ===============================
   D. RESET PASSWORD (OTP + New Password)
   =============================== */
router.post('/applicant/reset-password', async (req, res) => {
    try {
        const { nationalId, code, newPassword } = req.body;
        const pool = await getPool();

        // 1. Get user
        const userCheck = await pool.request()
            .input('NationalId', sql.Char(14), nationalId)
            .query('SELECT TOP 1 Id, Email FROM Applications WHERE NationalId = @NationalId');

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const applicant = userCheck.recordset[0];

        // 2. Verify OTP
        const currentTime = new Date();
        const otpCheck = await pool.request()
            .input('Email', sql.NVarChar, applicant.Email)
            .input('Code', sql.Char(6), code)
            .input('CurrentTime', sql.DateTime, currentTime)
            .query(`
                SELECT TOP 1 * FROM OTP_Codes 
                WHERE Email = @Email 
                AND Code = @Code 
                AND IsUsed = 0 
                AND ExpiresAt > @CurrentTime
            `);

        if (otpCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'الرمز غير صحيح أو منتهي الصلاحية' });
        }

        // 3. Mark OTP used
        const otpRecord = otpCheck.recordset[0];
        const otpId = otpRecord.Id || otpRecord.id || otpRecord.ID;
        if (otpId) {
            const safeId = parseInt(otpId, 10);
            await pool.request().query(`UPDATE OTP_Codes SET IsUsed = 1 WHERE Id = ${safeId}`);
        }

        // 4. Validate and hash new password
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }

        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 5. Update password
        const safeUserId = parseInt(applicant.Id, 10);
        await pool.request()
            .query(`UPDATE Applications SET Password = '${hashedPassword}', PasswordSetAt = GETDATE() WHERE Id = ${safeUserId}`);

        res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });

    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;

