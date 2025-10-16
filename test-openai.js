const OpenAI = require('openai');
require('dotenv').config();

console.log('🧪 Probando OpenAI API directamente...\n');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tools = [
  {
    type: 'function',
    function: {
      name: 'write_excel',
      description: 'Escribe datos a un archivo Excel',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Ruta del archivo Excel a crear' },
          data: { 
            type: 'array', 
            items: { 
              type: 'object',
              additionalProperties: true
            },
            description: 'Datos a escribir en el archivo' 
          },
          sheetName: { type: 'string', description: 'Nombre de la hoja (opcional)' }
        },
        required: ['filePath', 'data']
      }
    }
  }
];

async function testOpenAI() {
  try {
    console.log(`📡 Enviando solicitud a OpenAI con modelo: ${process.env.OPENAI_MODEL}`);
    console.log(`🔧 Herramientas disponibles: ${tools.length}`);
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Crea un archivo Excel llamado "test.xlsx" con una lista de frutas: manzana, banana, naranja'
        }
      ],
      tools: tools,
      tool_choice: 'auto',
      temperature: 1,
      max_completion_tokens: 2000,
    });

    console.log('\n📋 Respuesta de OpenAI:');
    console.log('Model usado:', completion.model);
    console.log('Choices:', completion.choices.length);
    
    const choice = completion.choices[0];
    if (choice?.message) {
      console.log('\n💬 Mensaje:');
      console.log('Content:', choice.message.content);
      console.log('Tool calls:', choice.message.tool_calls ? choice.message.tool_calls.length : 'ninguno');
      
      if (choice.message.tool_calls) {
        choice.message.tool_calls.forEach((toolCall, index) => {
          console.log(`\n🔧 Tool Call ${index + 1}:`);
          console.log('Name:', toolCall.function.name);
          console.log('Arguments:', toolCall.function.arguments);
        });
      }
    }
    
    console.log('\n✅ Prueba completada exitosamente');
    
  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testOpenAI();