# Deployment Guide (Docker)

This guide explains how to deploy the bot using Docker and Docker Compose on a server. While the instructions are generic, they have been tested on a DigitalOcean Droplet running Ubuntu.

## Prerequisites

*   A server or virtual private server (VPS) with Docker and Docker Compose installed.
*   Git installed on the server.
*   Your bot's repository accessible from the server.

## Deployment Steps

1.  **Connect to Your Server:**
    *   SSH into your server where you plan to run the bot.
    ```bash
    ssh your_user@your_server_ip
    ```

2.  **Clone the Repository:**
    *   Clone your bot's repository onto the server.
    ```bash
    git clone <your-repository-url>
    cd x-bot
    ```

3.  **Create the Environment File:**
    *   Copy the example environment file to create your production configuration.
    ```bash
    cp .env.example .env
    ```
    *   **Edit the `.env` file** using a terminal editor like `nano` or `vim` and fill in all your production credentials.
    ```bash
    nano .env
    ```
    *   **Crucial Settings:**
        *   Set `NODE_ENV=production`.
        *   Set `SIMULATE_MODE=false` to enable live posting.
        *   Fill in your `X_...` API keys and `OPENAI_API_KEY`.

4.  **Build and Run with Docker Compose:**
    *   Use Docker Compose to build the image and run the container in the background.
    ```bash
    docker-compose up --build -d
    ```
    *   `--build`: Forces Docker to rebuild the image using the latest code in your `Dockerfile`.
    *   `-d`: Runs the container in detached mode (it runs in the background).

## Managing the Bot

*   **Check Logs:**
    *   To see the bot's live output and monitor its activity:
    ```bash
    docker-compose logs -f x-bot-app
    ```
    *   Press `Ctrl+C` to stop viewing the logs.

*   **Stopping the Bot:**
    *   To stop and remove the running container:
    ```bash
    docker-compose down
    ```

## Updating the Bot

To update your bot with the latest code from your repository, follow these steps:

1.  **SSH into the server** and navigate to the `x-bot` directory.
2.  **Pull the latest code** from your repository:
    ```bash
    git pull origin main
    ```
3.  **Rebuild and restart the container** with the updated code:
    ```bash
    docker-compose up --build -d
    ```
