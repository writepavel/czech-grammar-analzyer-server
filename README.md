# Czech Grammar Analyzer Server

This is a serverless function for the Czech Grammar Analyzer project. It provides an API endpoint for analyzing Czech words, fetching data from online resources.

## Local Development

1. Clone this repository:
   ```
   git clone https://github.com/your-username/czech-grammar-analyzer-server.git
   ```

2. Navigate to the project directory:
   ```
   cd czech-grammar-analyzer-server
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   vercel dev
   ```

## Deployment on Vercel

1. Install the Vercel CLI:
   ```
   npm i -g vercel
   ```

2. Deploy to Vercel:
   ```
   vercel
   ```

3. Follow the prompts to link your project to a Vercel account and complete the deployment.

## API

### GET /analyze?word=:word

Analyzes the given Czech word and returns grammatical information.

**Response:**

```json
{
  "word": "mluvit",
  "priruckaData": {
    // Data from prirucka.ujc.cas.cz
  },
  "slovnikData": {
    // Data from slovnik.seznam.cz
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.