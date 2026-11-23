import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { Button } from 'antd';

const Login = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm();

  const navigate = useNavigate();

  const onSubmit = async (data) => {
    try {
      // Send request to obtain tokens
      const response = await fetch("http://127.0.0.1:8000/api/token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });

      const json = await response.json();

      if (response.ok) {
        // Store tokens securely in localStorage
        localStorage.setItem("accessToken", json.access);
        localStorage.setItem("refreshToken", json.refresh);
        console.log("Access Token: ", json.access);
        // Redirect to the dashboard (authenticated page)
        navigate("/");
      } else {
        throw new Error(json.detail || "Login failed");
      }
    } catch (error) {
      setError("root", { type: "manual", message: error.message });
    }
  };

  return (
    <Layout title="Login">
      <div className={`dc-page ${config.container}`}>
        <div className="m-20">
          <div className="flex items-center justify-center m-20">
            <div className="px-10 py-6 mt-20 text-center">
              <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
                <div className="h-[200rem]">
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
                  <Link
                    to="/auth/password/reset-password"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </Link><br />
                  <Button
                    type="primary"
                    htmlType="submit"
                    className="custom-button px-20 py-2 leading-5 text-white transition-colors duration-200 transform bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:bg-blue-700"
                  >
                    Login
                  </Button>
                  <Link to="/signup"
                      type="default"
                      className="custom-button px-20 py-2 leading-5 text-white transition-colors duration-200 transform bg-blue-600 rounded-md focus:outline-none focus:bg-blue-700"
                    >
                      Create new account
                    
                  </Link>
                </div>
                {errors.root && (
                  <span className="text-xs text-red-600">{errors.root.message}</span>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
