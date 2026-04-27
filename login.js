export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi' });
  }

  if (username === validUsername && password === validPassword) {
    const secret = process.env.SESSION_SECRET || 'nexa-default-secret';
    const timestamp = Date.now();
    const token = Buffer.from(`${timestamp}:${secret}`).toString('base64');

    return res.status(200).json({
      success: true,
      token,
      expiresAt: timestamp + (8 * 60 * 60 * 1000)
    });
  }

  return new Promise(resolve => {
    setTimeout(() => {
      res.status(401).json({ error: 'Username atau password salah' });
      resolve();
    }, 1000);
  });
}
