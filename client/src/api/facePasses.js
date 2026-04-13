import api from "./instance";

export const FacePassesService = {
  AddFacePassTelegram: async ({ photo, latitude, longitude, direction }) => {
    const formData = new FormData();
    formData.append("photo", photo);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("direction", direction);

    const res = await api.post("/face-passes", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  },
  getFacePasses: async (params = {}) => {
    const res = await api.get("/face-passes", { params });
    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },
};
