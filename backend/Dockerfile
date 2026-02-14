FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Ensure storage and logs directories exist
RUN mkdir -p storage/projects logs

EXPOSE 3000

CMD ["npm", "start"]
