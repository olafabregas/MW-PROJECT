export default function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  if (res.headersSent) return next(err);
  res.status(status).json({ error: message });
}
