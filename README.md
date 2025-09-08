# TFM Documentation

## Requirements
Before you begin, ensure you have met the following requirements:

- [Node.js](https://nodejs.org/) (version 14 or later)
- A code editor such as [Visual Studio Code](https://code.visualstudio.com/) (optional)

### Testing Requirements
To check your Node.js and npm versions, run the following commands in your terminal:
```
node -v
npm -v
```

## Installation
To install TFM, follow these steps:
1. Clone the repository:
   ```bash
   git clone https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation.git
   ```
2. Navigate to the project directory:
   ```bash
   cd TFM-Documentation
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

## Usage
To run the documentation locally, follow these steps:
1. Start the development server:
   ```bash
   npm run docs:dev
   ```
2. Open your web browser and go to [http://localhost:5173/TFM-Documentation/](http://localhost:5173/TFM-Documentation/) to view the documentation.

## Build & Testing
Before push to main branch, ensure that the documentation builds correctly by running:
```bash
npm run docs:build
```

## CI/CD
This project uses GitHub Actions for continuous integration and deployment. The workflow is defined in the `.github/workflows/deploy.yml` file.

The deployment process is triggered on pushes to the `main` branch. The built documentation is deployed to [GitHub Pages](https://thuenen-forest-ecosystems.github.io/TFM-Documentation/).