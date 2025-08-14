export default (schema) => (req, res, next) => {
  const toValidate = ['params', 'query', 'body'].reduce((acc, key) => {
    if (schema[key]) acc[key] = req[key];
    return acc;
  }, {});
  const { error, value } = schema.validate(toValidate, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
  }
  Object.assign(req, value);
  return next();
};
