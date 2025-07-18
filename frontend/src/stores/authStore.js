import { create } from "zustand";
import { axiosInstance } from "../lib/axiosInstance";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useChatStore } from "./messageStore";

const BASE_URL = "http://localhost:8000/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLogingIn: false,
  checkingAuth: false,
  updatingProfile: false,
  fetchingUsers: false,
  allUsers: [],
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    set({ checkingAuth: true });
    try {
      const response = await axiosInstance.get("/auth/check-auth");
      const { user } = response.data;
      set({ authUser: user });
      get().connectSocket();
    } catch (error) {
      toast.error(error?.response?.data?.message || "error occured");
      console.log(error);
      set({ authUser: null });
    } finally {
      set({ checkingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const response = await axiosInstance.post("/auth/signup", data);
      const { userData, message } = response.data;
      console.log("Signup response:", response.data);
      set({ authUser: userData });
      toast.success(message);
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
      console.error("Signup failed:", error);
    } finally {
      set({ isSigningUp: false });
    }
  },
  login: async (data) => {
    set({ isLogingIn: true });
    try {
      const response = await axiosInstance.post("/auth/login", data);
      const { user, message } = response.data;
      set({ authUser: user });
      toast.success(message || "Loged in successfully");
      get().connectSocket();
    } catch (error) {
      console.log(error);
      set({ authUser: null });
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLogingIn: false });
    }
  },

  logout: async () => {
    await axiosInstance.post("/auth/logout");
    set({ authUser: null });
    get().disconnectSocket();
  },

  updateProfile: async (data) => {
    set({ updatingProfile: true });
    try {
      const response = await axiosInstance.put("/auth/update-profile", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const { user, message } = response.data;
      set({ authUser: user });
      toast.success(message || "updated successfully");
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "updation failed");
    } finally {
      set({ updatingProfile: false });
    }
  },

  getAllUsers: async () => {
    set({ fetchingUsers: true });
    try {
      const response = await axiosInstance.get("/auth/users");
      const { users } = response.data;
      set({ allUsers: users });
    } catch (error) {
      set({ allUsers: [] });
    } finally {
      set({ fetchingUsers: false });
    }
  },

  connectSocket: () => {
    const { authUser, socket: existingSocket } = get();
    if (!authUser || existingSocket?.connected) return;

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      autoConnect: true,
    });

    set({ socket });
    const { addNewMessage } = useChatStore.getState();

    // setup listeners
    const onOnlineUsers = (onlineUsers) => set({ onlineUsers });
    const onNewMessage = (newMessage) => addNewMessage(newMessage);
    const onConnect = () => console.log("socket connected");
    const onDisconnect = () => console.log("socket disconnected");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("getOnlineUsers", onOnlineUsers);
    socket.on("newMessage", onNewMessage);

    // Return cleanup function for external use
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("getOnlineUsers", onOnlineUsers);
      socket.off("newMessage", onNewMessage);
      socket.disconnect();
    };
  },

  disconnectSocket: () => {
    const { socket, userId } = get();

    if (socket?.connected) {
      socket.emit("user-disconnected", { userId });
      socket.disconnect();
    }
  },
}));
