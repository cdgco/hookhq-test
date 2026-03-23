import * as authSchema from "./auth.schema"; // This will be generated in a later step
import * as environmentsSchema from "./environments.schema"; // This will be generated in a later step
import * as webhooksSchema from "./webhooks.schema"; // This will be generated in a later step

export const schema = {
  ...authSchema,
  ...environmentsSchema,
  ...webhooksSchema,
} as const;
