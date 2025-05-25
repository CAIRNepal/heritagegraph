# # Use an official Python runtime as a parent image
# FROM python:3.11-slim

# # Set environment variables
# ENV PYTHONDONTWRITEBYTECODE=1
# ENV PYTHONUNBUFFERED=1

# # Set the working directory in the container
# WORKDIR /app/heritage_graph

# # Install system dependencies and clean up
# RUN apt-get update && \
#     apt-get install -y --no-install-recommends \
#     gcc \
#     python3-dev \
#     netcat && \
#     rm -rf /var/lib/apt/lists/*

# # Install Python dependencies
# COPY requirements.txt /app/
# RUN pip install --no-cache-dir -r /app/requirements.txt && \
#     rm -rf /root/.cache/pip

# # Copy the Django project into the container
# COPY . /app/

# # Copy and set permissions for entrypoint script
# COPY entrypoint.sh /app/entrypoint.sh
# RUN chmod +x /app/entrypoint.sh

# # Expose the port the app runs on
# EXPOSE 8000

# # Set entrypoint script
# ENTRYPOINT ["/app/entrypoint.sh"]

# # Default command
# CMD ["python", "manage.py", "runserver"]

# Build stage is optional if you already built React locally
# Just copy build folder and serve with nginx

FROM nginx:alpine

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy React build files into nginx's static folder
COPY heritage_graph_ui/build /usr/share/nginx/html

# Copy custom nginx config (optional, if you made one)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
