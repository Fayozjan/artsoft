import axios from "axios";

const API_URL = "http://localhost:5000/api/form";

export const submitFormData = async (data) => {
  try {
    const response = await axios.post(API_URL, data);
    return response.data;
  } catch (error) {
    console.error("Ошибка при отправке данных:", error); // Для отладки
    throw new Error("Ошибка при отправке данных");
  }
};
