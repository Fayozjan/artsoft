import api from "./instance";

export const getMenus = async () => {
  const res = await api.get("/menus");
  return res.data.data;
};
