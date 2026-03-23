import { getDb } from "@/db";
import { apikeys } from "@/db/auth.schema";
import { eq, and } from "drizzle-orm";
import { hasPermission, isValidApiKeyFormat, ApiKeyPermission, hasResourcePermission, ResourceType, CrudOperation } from "./apiKeys";

export interface ApiKeyAuthResult {
    valid: boolean;
    userId?: string;
    permissions?: ApiKeyPermission[];
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * Validate an API key and return user information
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyAuthResult> {
    try {
        // Basic format validation
        if (!isValidApiKeyFormat(apiKey)) {
            console.error("Invalid API key format");
            return {
                valid: false,
                error: "Invalid API key format"
            };
        }

        const db = await getDb();
        
        // Look up the API key in the database
        const keyRecord = await db
            .select()
            .from(apikeys)
            .where(and(
                eq(apikeys.key, apiKey),
                eq(apikeys.enabled, true)
            ))
            .limit(1);

        if (keyRecord.length === 0) {
            console.error("Invalid or disabled API key");
            return {
                valid: false,
                error: "Invalid or disabled API key"
            };
        }

        const key = keyRecord[0];
        
        // Check if the key has expired
        if (key.expiresAt && new Date() > key.expiresAt) {
            console.error("API key has expired");
            return {
                valid: false,
                error: "API key has expired"
            };
        }

        // Parse permissions
        const permissions = key.permissions ? JSON.parse(key.permissions) : [];

        // Update last used timestamp
        await db
            .update(apikeys)
            .set({ 
                lastRequest: new Date(),
                updatedAt: new Date()
            })
            .where(eq(apikeys.id, key.id));

        return {
            valid: true,
            userId: key.userId,
            permissions,
            metadata: key.metadata ? JSON.parse(key.metadata) : undefined
        };
    } catch (error) {
        console.error("Error validating API key:", error);
        console.error(error);
        return {
            valid: false,
            error: "Internal server error"
        };
    }
}

/**
 * Check if an API key has the required permission
 */
export async function checkApiKeyPermission(
    apiKey: string, 
    requiredPermission: ApiKeyPermission
): Promise<ApiKeyAuthResult> {
    const authResult = await validateApiKey(apiKey);
    
    if (!authResult.valid || !authResult.permissions || !authResult.metadata) {
        return authResult;
    }

    if (!hasPermission(authResult.permissions, requiredPermission)) {
        return {
            valid: false,
            error: `Insufficient permissions. Required: ${requiredPermission}`
        };
    }

    return authResult;
}

/**
 * Check if an API key has permission for a specific resource and operation
 */
export async function checkResourcePermission(
    apiKey: string,
    resource: ResourceType,
    operation: CrudOperation
): Promise<ApiKeyAuthResult> {
    const authResult = await validateApiKey(apiKey);
    
    if (!authResult.valid || !authResult.permissions || !authResult.metadata) {
        return authResult;
    }

    if (!hasResourcePermission(authResult.permissions, resource, operation)) {
        return {
            valid: false,
            error: `Insufficient permissions. Required: ${resource}:${operation}`
        };
    }

    return authResult;
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
    if (!authHeader) return null;
    
    // Support both "Bearer wh_..." and "wh_..." formats
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    
    if (authHeader.startsWith("wh_")) {
        return authHeader;
    }
    
    return null;
}
