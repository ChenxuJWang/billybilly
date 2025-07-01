# LLM Transaction Categorization Demo

This is an isolated test demo project for implementing LLM-powered transaction categorization using the Doubao API. The demo allows users to test transaction categorization functionality before integrating it into the main billybilly expense tracker project.

## Features

- **Secure API Key Handling**: Enter and confirm your Doubao API key (not hardcoded for security)
- **Configurable System Prompt**: Customize the system prompt for transaction categorization
- **CSV Data Upload**: Upload transaction data and validation data CSV files
- **Sample Data**: Pre-loaded Alipay and WeChat sample data for testing
- **Real-time Categorization**: Uses Doubao 1.6 Flash model with streaming responses
- **Validation & Accuracy**: Compare LLM results with expected categories and show accuracy metrics
- **Error Handling**: Robust error handling for API failures and invalid responses

## Workflow

1. **API Key Configuration**: Enter your Doubao API key and confirm
2. **System Prompt Setup**: Review and confirm the categorization system prompt
3. **Data Upload**: Upload CSV files or use sample data (Alipay/WeChat templates)
4. **Optional Message**: Add custom instructions for the LLM
5. **Generate Categorization**: Send data to Doubao API and receive streaming responses
6. **View Results**: See categorized transactions with validation status and accuracy metrics

## CSV Format

### Transaction Data CSV
Expected columns:
- Date/Time
- Description
- Amount
- Counterparty

### Validation Data CSV
Single column containing expected categories for each transaction:
- Bills & Utilities
- Entertainment
- Food & Dining
- Healthcare
- Shopping
- Transportation
- HTT (Hard To Tell)
- Salary
- Freelance
- Investment
- Refund

## API Response Format

The LLM should return JSON in this structure:
```json
{
  "transactions": [
    {
      "id": "<self-increment id>",
      "category": "<one of the provided categories>"
    }
  ]
}
```

## Installation & Setup

1. Clone or download this demo project
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173 in your browser

## Security Notes

- API keys are handled securely and not stored in the codebase
- The demo requires manual API key entry for each session
- All API communication uses HTTPS

## Sample Data

The demo includes two sets of sample data:
- **Alipay Sample**: TransactionTest1.csv with 49 transactions
- **WeChat Sample**: Transactiontest2.csv with 9 transactions

Each sample includes corresponding validation data for accuracy testing.

## Technology Stack

- **Frontend**: React with Vite
- **UI Components**: shadcn/ui with Tailwind CSS
- **Icons**: Lucide React
- **API**: Doubao 1.6 Flash model
- **Streaming**: Server-Sent Events (SSE) handling

## Error Handling

The demo includes comprehensive error handling for:
- Invalid API keys
- Network failures
- Malformed JSON responses
- Missing transaction data
- API rate limits

## Integration Notes

This demo is designed to be integrated into the main billybilly project. Key components that can be reused:
- API integration logic
- CSV parsing functions
- Validation algorithms
- UI components for transaction display

## Development

To modify the system prompt or add new categories:
1. Update the `systemPrompt` state in `App.jsx`
2. Modify the validation categories in the CSV files
3. Update the UI components as needed

## Troubleshooting

**Common Issues:**
- **CORS Errors**: Ensure the Doubao API supports cross-origin requests
- **Streaming Issues**: Check network connectivity and API key validity
- **CSV Parsing**: Verify CSV format matches expected structure
- **Dependency Conflicts**: Use `--legacy-peer-deps` flag when installing

## License

This demo project is for testing purposes only. Please ensure compliance with Doubao API terms of service.

