# Límites de Tokens y Modelos OpenAI

## Resumen

Este documento describe la implementación de límites de tokens basados en modelos específicos y tiers de OpenAI para el sistema de procesamiento de PDFs.

## Modelos Soportados

### Serie GPT-5 (Más Reciente)
- **GPT-5**: Modelo principal más reciente
  - Input: $3.00/1M tokens
  - Output: $12.00/1M tokens
- **GPT-5-chat-latest**: Versión optimizada para conversaciones
  - Input: $2.50/1M tokens
  - Output: $10.00/1M tokens
- **GPT-5-codex**: Versión especializada para código
  - Input: $3.00/1M tokens
  - Output: $12.00/1M tokens
- **GPT-5-mini**: Versión optimizada para tareas simples
  - Input: $0.20/1M tokens  
  - Output: $0.80/1M tokens
- **GPT-5-nano**: Versión ultra-eficiente para procesamiento básico
  - Input: $0.20/1M tokens
  - Output: $0.80/1M tokens
- **GPT-5-pro**: Versión profesional avanzada
  - Input: $2.50/1M tokens
  - Output: $10.00/1M tokens

### Serie GPT-4.1
- **GPT-4.1**: Modelo principal más reciente
  - Input: $1.25/1M tokens
  - Output: $10.00/1M tokens
- **GPT-4.1-mini**: Versión optimizada para tareas simples
  - Input: $0.25/1M tokens  
  - Output: $2.00/1M tokens
- **GPT-4.1-nano**: Versión ultra-eficiente para procesamiento básico
  - Input: $0.05/1M tokens
  - Output: $0.40/1M tokens

### Serie GPT-4o (Actual)
- **GPT-4o**: Modelo multimodal optimizado
  - Input: $2.50/1M tokens
  - Output: $10.00/1M tokens
- **GPT-4o-mini**: Versión ligera de GPT-4o
  - Input: $0.15/1M tokens
  - Output: $0.60/1M tokens

### Serie GPT-4 Turbo
- **GPT-4-turbo**: Modelo turbo optimizado
  - Input: $10.00/1M tokens
  - Output: $30.00/1M tokens

### Serie GPT-3.5 Turbo
- **GPT-3.5-turbo**: Modelo eficiente y económico
  - Input: $0.50/1M tokens
  - Output: $1.50/1M tokens

## Límites por Tier (OpenAI API) - ACTUALIZADO TIER 2

### Tier 2 (Implementación Actual)
**Requisitos**: $50 gastados + 7 días desde primer pago

| Modelo | TPM (Tokens por Minuto) | Límite por Mensaje | Límite por Conversación |
|--------|-------------------------|-------------------|------------------------|
| GPT-5 | 1,000,000 | 25,000 | 60,000 |
| GPT-5-chat-latest | 450,000 | 20,000 | 50,000 |
| GPT-5-codex | 1,000,000 | 25,000 | 60,000 |
| GPT-5-mini | 2,000,000 | 30,000 | 75,000 |
| GPT-5-nano | 2,000,000 | 30,000 | 75,000 |
| GPT-5-pro | 450,000 | 20,000 | 50,000 |
| GPT-3.5-turbo | 2,000,000 | 20,000 | 50,000 |
| GPT-3.5-turbo-instruct | 90,000 | 15,000 | 30,000 |
| GPT-4 | 40,000 | 15,000 | 35,000 |
| GPT-4-turbo | 450,000 | 20,000 | 50,000 |
| GPT-4.1 | 450,000 | 20,000 | 50,000 |
| GPT-4.1-mini | 2,000,000 | 25,000 | 60,000 |
| GPT-4.1-nano | 2,000,000 | 25,000 | 60,000 |
| GPT-4o | 450,000 | 20,000 | 50,000 |
| GPT-4o-mini | 2,000,000 | 25,000 | 60,000 |

### Tier 1 (Referencia)
**Requisitos**: $5 gastados + 7 días desde primer pago

| Modelo | TPM (Tokens por Minuto) | Límite por Mensaje | Límite por Conversación |
|--------|-------------------------|-------------------|------------------------|
| GPT-3.5-turbo | 90,000 | 8,000 | 20,000 |
| GPT-4 | 10,000 | 8,000 | 20,000 |
| GPT-4-turbo | 150,000 | 12,000 | 30,000 |
| GPT-4o | 150,000 | 12,000 | 30,000 |
| GPT-4o-mini | 500,000 | 15,000 | 40,000 |

## Implementación Técnica

### Configuración de Límites (Tier 2 Actual)

```typescript
const MODEL_LIMITS = {
  // Configuración actual para Tier 2
  'gpt-5': {
    tier2: { tpm: 1000000, maxPerMessage: 25000, maxPerConversation: 60000 }
  },
  'gpt-5-chat-latest': {
    tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 }
  },
  'gpt-5-codex': {
    tier2: { tpm: 1000000, maxPerMessage: 25000, maxPerConversation: 60000 }
  },
  'gpt-5-mini': {
    tier2: { tpm: 2000000, maxPerMessage: 30000, maxPerConversation: 75000 }
  },
  'gpt-5-nano': {
    tier2: { tpm: 2000000, maxPerMessage: 30000, maxPerConversation: 75000 }
  },
  'gpt-5-pro': {
    tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 }
  },
  'gpt-4o': {
    tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 }
  },
  'gpt-4o-mini': {
    tier2: { tpm: 2000000, maxPerMessage: 25000, maxPerConversation: 60000 }
  },
  'gpt-4.1': {
    tier2: { tpm: 450000, maxPerMessage: 20000, maxPerConversation: 50000 }
  },
  'gpt-4.1-mini': {
    tier2: { tpm: 2000000, maxPerMessage: 25000, maxPerConversation: 60000 }
  },
  'gpt-3.5-turbo': {
    tier2: { tpm: 2000000, maxPerMessage: 20000, maxPerConversation: 50000 }
  }
};
```

### Estimación de Tokens

Para PDFs, se utiliza la siguiente estimación:
- **1 token ≈ 0.75 palabras** (inglés)
- **1 token ≈ 0.5 palabras** (español)
- **Fórmula**: `tokens = Math.ceil(text.length / 3)`

### Control de Límites (Actualizados para Tier 2)

1. **Por Mensaje**: Hasta 25,000 tokens por solicitud individual (modelos mini)
2. **Por Conversación**: Hasta 60,000 tokens acumulados (modelos mini)
3. **Reinicio**: Los tokens se reinician al comenzar nueva conversación
4. **TPM**: Hasta 2,000,000 tokens por minuto (modelos mini)

## Estrategias de Optimización

### Selección de Modelo por Tarea

1. **Procesamiento inicial de PDFs**: GPT-5-nano o GPT-5-mini
2. **Análisis complejo**: GPT-5 o GPT-5-pro
3. **Tareas simples**: GPT-5-mini o GPT-4.1-mini
4. **Extracción de texto**: GPT-5-nano o GPT-5-mini
5. **Desarrollo de código**: GPT-5-codex
6. **Conversaciones**: GPT-5-chat-latest

### Manejo de Documentos Grandes (Tier 2)

1. **Fragmentación**: Dividir PDFs en chunks de ~20,000 tokens (Tier 2)
2. **Resumen progresivo**: Procesar por secciones y resumir
3. **Filtrado inteligente**: Extraer solo contenido relevante
4. **Procesamiento paralelo**: Aprovechar los altos límites TPM

## Configuración Recomendada

### Para Tier 2 (Implementación Actual)
```typescript
const config = {
  model: 'gpt-5',
  tier: 2,
  maxTokensPerMessage: 25000,
  maxTokensPerConversation: 60000
};
```

### Para Tier 2 con Modelos Mini (Máximo Rendimiento)
```typescript
const config = {
  model: 'gpt-5-mini',
  tier: 2,
  maxTokensPerMessage: 30000,
  maxTokensPerConversation: 75000
};
```

### Para Tier 2 con Modelos Especializados
```typescript
const configCode = {
  model: 'gpt-5-codex',
  tier: 2,
  maxTokensPerMessage: 25000,
  maxTokensPerConversation: 60000
};

const configChat = {
  model: 'gpt-5-chat-latest',
  tier: 2,
  maxTokensPerMessage: 20000,
  maxTokensPerConversation: 50000
};
```

## Monitoreo y Alertas

### Métricas Importantes
- Tokens consumidos por conversación
- Tokens por minuto (TPM) actual
- Porcentaje de límite utilizado
- Errores por límites excedidos

### Alertas Configuradas
- **80% del límite por conversación**: Advertencia
- **90% del límite por conversación**: Alerta crítica
- **Límite excedido**: Error con sugerencias

## Referencias

- [OpenAI Pricing](https://platform.openai.com/docs/pricing)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Usage Tiers](https://platform.openai.com/docs/guides/rate-limits/usage-tiers)

---

**Última actualización**: Enero 2025  
**Versión**: 1.0  
**Implementado en**: `src/services/integratedMcpService.ts`, `src/services/openaiService.ts`