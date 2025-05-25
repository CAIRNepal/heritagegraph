import React from "react";
import { useForm } from "react-hook-form";
import { AuthActions } from "../templates/auth/util";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm();

  const navigate = useNavigate();
  const { login, storeToken } = AuthActions();

  const onSubmit = async (data) => {
    try {
      const response = await login(data.username, data.password);
      const json = await response.json();

      if (response.ok) {
        
        storeToken(json.access, "access");
        storeToken(json.refresh, "refresh");
        
        // navigate("/dashboard");
      } else {
        throw new Error(json.detail || "Login failed");
      }
    } catch (error) {
      setError("root", { type: "manual", message: error.message });
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="px-8 py-6 mt-4 text-center">
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
          <div className="flex justify-between">
            <label className="block" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              placeholder="Username"
              {...register("username", { required: "Username is required" })}
              className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {errors.username && (
              <span className="text-xs text-red-600">{errors.username.message}</span>
            )}
          </div>
          <div className="mt-4">
            <label className="block" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              placeholder="Password"
              {...register("password", { required: "Password is required" })}
              className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {errors.password && (
              <span className="text-xs text-red-600">
                {errors.password.message}
              </span>
            )}
          </div>
          <div className="flex items-between justify-between mt-4">
            <button className="px-20 py-2 leading-5 text-white transition-colors duration-200 transform bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:bg-blue-700">
              Login
            </button>
          </div>
          {errors.root && (
            <span className="text-xs text-red-600">{errors.root.message}</span>
          )}
        </form>
        <div className="mt-6 text-center">
          <Link
            to="/auth/password/reset-password"
            className="text-sm text-blue-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
