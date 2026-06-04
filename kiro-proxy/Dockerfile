FROM node:20-slim

WORKDIR /app

# Install curl, bash, unzip, and certificates
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Kiro CLI headlessly
RUN curl -fsSL https://cli.kiro.dev/install | bash
ENV PATH="/root/.local/bin:${PATH}"

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the proxy source code
COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "start"]
