import axios from "axios";

export interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  async sendMessage(form: ContactForm) {
    const response = await axios.post("/api/contact", form);
    return response.data;
  },
};
