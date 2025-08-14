import Joi from 'joi';

const schema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    subject: Joi.string().min(2).required(),
    message: Joi.string().min(2).required()
  }).required()
});

export async function sendContact(req, res) {
  const { error } = schema.validate({ body: req.body });
  if (error) return res.status(400).json({ error: error.message });
  // In real life, queue an email or persist a ticket
  res.json({ message: 'Your message has been received' });
}
