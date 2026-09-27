# Use official Node.js v24 runtime as parent image
FROM node:24-slim

# Set working directory inside container
WORKDIR /app

# Copy package files with node user ownership
COPY --chown=node:node package.json ./

# Install dependencies (none in this case, but standard practice)
RUN npm install

# Copy the rest of the application files with node user ownership
COPY --chown=node:node . .

# Ensure the node user owns the /app directory to allow creating the SQLite file
RUN chown -R node:node /app

# Switch to the node user (UID 1000)
USER node

# Hugging Face Spaces runs on port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Command to run the application
CMD ["node", "server.js"]
