import api from "./instance";

export const getStockReportBalances = async (params) => {
  const res = await api.get("/stock-report/balances", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getStockReportBalanceLots = async (productId, locationId) => {
  const res = await api.get("/stock-report/balances/lots", {
    params: { product_id: productId, location_id: locationId },
  });
  return {
    data: res.data.data,
  };
};

export const getStockReportMovements = async (params) => {
  const res = await api.get("/stock-report/movements", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getStockReportTurnover = async (params) => {
  const res = await api.get("/stock-report/turnover", { params });
  return {
    data: res.data.data,
    location: res.data.location,
    pagination: res.data.pagination,
  };
};

export const getStockReportTurnoverLots = async ({ locationId, dateFrom, dateTo, productId }) => {
  const res = await api.get("/stock-report/turnover/lots", {
    params: { location_id: locationId, date_from: dateFrom, date_to: dateTo, product_id: productId },
  });
  return {
    data: res.data.data,
  };
};
