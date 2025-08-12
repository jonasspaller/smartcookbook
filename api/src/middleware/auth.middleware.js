const jwt = require('jsonwebtoken');

exports.jwtMiddleware = (req, res, next) => {
	const token = req.cookies.token;

	if (!token) {
		return res.status(401).json({ error: 'Unauthorized: No token provided' });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded; // Fügt das User-Payload zum Request-Objekt hinzu
		next();
	} catch (error) {
		res.clearCookie('token');
		return res.status(401).json({ error: 'Unauthorized: Invalid token' });
	}
};
