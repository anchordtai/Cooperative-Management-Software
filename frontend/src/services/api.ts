import axios from "axios";

// Use the environment variable for the API base URL or fallback to localhost
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Enable credentials globally for axios
axios.defaults.withCredentials = true;

// Create an axios instance with default configurations
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Ensure credentials (cookies, etc.) are sent with requests
});

// Add an interceptor to handle errors globally (optional)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle CORS or other errors globally
    if (error.response?.status === 401) {
      console.error("Unauthorized access - perhaps login is required.");
    } else if (error.response?.status === 403) {
      console.error(
        "Forbidden - you do not have permission to access this resource."
      );
    } else if (error.message.includes("Network Error")) {
      console.error("Network Error - please check your backend server.");
    }
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  login: async (
    email: string,
    password: string,
    twoFAMethod?: "email" | "sms"
  ) => {
    const response = await api.post(
      "/auth/login",
      twoFAMethod ? { email, password, twoFAMethod } : { email, password }
    );
    return response.data;
  },
  register: async (userData: any) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },
  logout: async () => {
    await api.post("/auth/logout");
  },
  verify2FA: async (email: string, code: string) => {
    const response = await api.post("/auth/verify-2fa", { email, code });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
};

// Member services
export const memberService = {
  getAll: async () => {
    const response = await api.get("/members");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/members/${id}`);
    return response.data;
  },
  create: async (memberData: any) => {
    const response = await api.post("/members", memberData);
    return response.data;
  },
  update: async (id: string, memberData: any) => {
    const response = await api.put(`/members/${id}`, memberData);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/members/${id}`);
    return response.data;
  },
};

// Transaction services
export const transactionService = {
  getAll: async () => {
    const response = await api.get("/transactions");
    return response.data;
  },
  create: async (transactionData: any) => {
    const response = await api.post("/transactions", transactionData);
    return response.data;
  },
  getByMember: async (memberId: string) => {
    const response = await api.get(`/transactions/member/${memberId}`);
    return response.data;
  },
};

// Loan services
export const loanService = {
  getAll: async () => {
    const response = await api.get("/financial/loans");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/financial/loans/${id}`);
    return response.data;
  },
  create: async (loanData: any) => {
    const response = await api.post("/financial/loans", loanData);
    return response.data;
  },
  update: async (id: string, loanData: any) => {
    const response = await api.put(`/financial/loans/${id}`, loanData);
    return response.data;
  },
  approve: async (id: string) => {
    const response = await api.post(`/financial/loans/${id}/approve`);
    return response.data;
  },
  reject: async (id: string) => {
    const response = await api.post(`/financial/loans/${id}/reject`);
    return response.data;
  },
};

// Settings services
export const settingsService = {
  get: async () => {
    const response = await api.get("/settings");
    return response.data;
  },
  update: async (settings: any) => {
    const response = await api.put("/settings", settings);
    return response.data;
  },
};

export default api;
