# Límites de Tokens y Modelos OpenAI

## Resumen

Este documento describe la implementación de límites de tokens basados en modelos específicos y tiers de OpenAI para el sistema de procesamiento de PDFs.

## Modelos Soportados

### Serie GPT-5 (Recomendado)
- **GPT-5**: Modelo principal más reciente
  - Input: $1.25/1M tokens
  - Output: $10.00/1M tokens
- **GPT-5-mini**: Versión optimizada para tareas simples
  - Input: $0.25/1M tokens  
  - Output: $2.00/1M tokens
- **GPT-5-nano**: Versión ultra-eficiente para procesamiento básico
  - Input: $0.05/1M tokens
  - Output: $0.40/1M tokens

### Serie GPT-4o (Actual)
- **GPT-4o**: Modelo multimodal optimizado
  - Input: $2.50/1M tokens
  - Output: $10.00/1M tokens
- **GPT-4o-mini**: Versión ligera de GPT-4o
  - Input: $0.15/1M tokens
  - Output: $0.60/1M tokens

## Límites por Tier (OpenAI API)

### Tier 1 (Implementación Actual)
**Requisitos**: $5 gastados + 7 días desde primer pago

| Modelo | TPM (Tokens por Minuto) | Límite por Mensaje | Límite por Conversación |
|--------|-------------------------|-------------------|------------------------|
| GPT-5 | 30,000 | 12,000 | 25,000 |
| GPT-5-mini | 200,000 | 12,000 | 25,000 |
| GPT-5-nano | 200,000 | 12,000 | 25,000 |
| GPT-4o | 30,000 | 12,000 | 25,000 |
| GPT-4o-mini | 200,000 | 12,000 | 25,000 |

### Tier 2 (Futuro)
**Requisitos**: $50 gastados + 7 días desde primer pago

| Modelo | TPM (Tokens por Minuto) |
|--------|-------------------------|
| GPT-5 | 450,000 |
| GPT-5-mini | 2,000,000 |
| GPT-5-nano | 2,000,000 |
| GPT-4o | 450,000 |
| GPT-4o-mini | 2,000,000 |

## Implementación Técnica

### Configuración de Límites

```typescript
const MODEL_LIMITS = {
  tier1: {
    'gpt-5': { tpm: 30000, maxPerMessage: 12000, maxPerConversation: 25000 },
    'gpt-5-mini': { tpm: 200000, maxPerMessage: 12000, maxPerConversation: 25000 },
    'gpt-5-nano': { tpm: 200000, maxPerMessage: 12000, maxPerConversation: 25000 },
    'gpt-4o': { tpm: 30000, maxPerMessage: 12000, maxPerConversation: 25000 },
    'gpt-4o-mini': { tpm: 200000, maxPerMessage: 12000, maxPerConversation: 25000 }
  }
};
```

### Estimación de Tokens

Para PDFs, se utiliza la siguiente estimación:
- **1 token ≈ 0.75 palabras** (inglés)
- **1 token ≈ 0.5 palabras** (español)
- **Fórmula**: `tokens = Math.ceil(text.length / 3)`

### Control de Límites

1. **Por Mensaje**: Máximo 12,000 tokens por solicitud individual
2. **Por Conversación**: Máximo 25,000 tokens acumulados
3. **Reinicio**: Los tokens se reinician al comenzar nueva conversación

## Estrategias de Optimización

### Selección de Modelo por Tarea

1. **Procesamiento inicial de PDFs**: GPT-5-nano o GPT-5-mini
2. **Análisis complejo**: GPT-5
3. **Tareas simples**: GPT-5-mini
4. **Extracción de texto**: GPT-5-nano

### Manejo de Documentos Grandes

1. **Fragmentación**: Dividir PDFs en chunks de ~10,000 tokens
2. **Resumen progresivo**: Procesar por secciones y resumir
3. **Filtrado inteligente**: Extraer solo contenido relevante

## Configuración Recomendada

### Para Tier 1 (Actual)
```typescript
const config = {
  model: 'gpt-5',
  tier: 'tier1',
  maxTokensPerMessage: 12000,
  maxTokensPerConversation: 25000
};
```

### Para Tier 2 (Futuro)
```typescript
const config = {
  model: 'gpt-5',
  tier: 'tier2',
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