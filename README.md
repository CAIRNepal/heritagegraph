# CHLOD (Cultural Heritage Linked Open Data)

## Overview
CHLOD is a structured schema based on CIDOC CRM to represent Nepal's cultural heritage data. This project facilitates standardized data representation and interoperability for cultural heritage datasets.

## Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Running the Application

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd chlod
   ```

2. Start the application using Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. The application should now be running at:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)

### Stopping the Application

To stop the application and remove the containers:
```bash
docker-compose down
```

To stop the application while preserving the containers:
```bash
docker-compose stop
```

### Viewing Logs

To view the logs of all containers:
```bash
docker-compose logs
```

To follow the logs in real-time:
```bash
docker-compose logs -f
```

## Accessing the Site

### Frontend
The frontend service is running on port 3000. You can access it by navigating to:
```
http://localhost:3000
```

### Backend
The backend service is running on port 8000. You can access it by navigating to:
```
http://localhost:8000
```

## Docker Containers

To check the status of the Docker containers, you can use the following command:
```sh
docker ps
```

This will show you the running containers and their respective ports.

## Directory Structure
```
chlod/
├── docker-compose.yml  # Docker Compose configuration
├── backend/            # Backend API implementation
├── frontend/           # Frontend application
└── README.md           # Project documentation
```

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch: `git checkout -b feature-branch`
3. Commit your changes: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature-branch`
5. Submit a pull request.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

## Contact
For any inquiries, reach out via [info@cair-nepal.org](mailto:info@cair-nepal.org).

## Troubleshooting

### Connection Issues

If you encounter connection issues, follow these steps:

1. **Check Docker Container Status**: Ensure that both the frontend and backend containers are running.
   ```sh
   docker ps
   ```

2. **Check Container Logs**: View the logs of the frontend and backend containers to see if there are any errors.
   ```sh
   docker-compose logs frontend
   docker-compose logs backend
   ```

3. **Restart Docker Containers**: Sometimes restarting the containers can resolve the issue.
   ```sh
   docker-compose restart
   ```

4. **Check Network Configuration**: Ensure that your firewall or proxy settings are not blocking the connections to ports 3000 and 8000.


### Test email
email: your_email+clerk_test@gmail.com
code: 424242
