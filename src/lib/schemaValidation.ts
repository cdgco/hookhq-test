import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validates a JSON schema itself to ensure it's valid
 */
export function validateSchema(schema: any): ValidationResult {
  try {
    // Check if schema is a valid JSON Schema
    const isValidSchema = ajv.validateSchema(schema);
    
    if (!isValidSchema) {
      return {
        valid: false,
        errors: ajv.errors?.map(error => `${error.instancePath || 'root'}: ${error.message}`) || ['Invalid schema']
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Validates data against a JSON schema
 */
export function validateData(schema: any, data: any): ValidationResult {
  try {
    // First validate the schema itself
    const schemaValidation = validateSchema(schema);
    if (!schemaValidation.valid) {
      return schemaValidation;
    }
    
    // Compile the schema for validation
    const validate = ajv.compile(schema);
    const isValid = validate(data);
    
    if (!isValid) {
      return {
        valid: false,
        errors: validate.errors?.map(error => `${error.instancePath || 'root'}: ${error.message}`) || ['Validation failed']
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [`Data validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Validates payload against an event type schema
 */
export function validateEventPayload(eventTypeSchema: string | null, payload: any): ValidationResult {
  if (!eventTypeSchema) {
    // No schema defined, payload is always valid
    return { valid: true };
  }
  
  try {
    const schema = JSON.parse(eventTypeSchema);
    return validateData(schema, payload);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid event type schema: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}
