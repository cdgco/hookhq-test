import type { SqsDestinationConfig } from "@/lib/destinations/types";
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HeaderBag } from '@aws-sdk/types';

function inferSqsRegion(queueUrl: URL): string | null {
  const host = queueUrl.hostname.toLowerCase();

  if (host === "queue.amazonaws.com" || host === "sqs.amazonaws.com") {
    return "us-east-1";
  }

  const patterns = [/^sqs[.-]([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?$/, /^([a-z0-9-]+)\.queue\.amazonaws\.com(?:\.cn)?$/];

  for (const pattern of patterns) {
    const match = host.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function signRequest(config: SqsDestinationConfig, host: string, region: string, body: string): Promise<HeaderBag> {
  const options = {
    hostname: host,
    path: new URL(config.queueUrl).pathname || "/",
    method: 'POST',
    headers: {
      'Host': host,
      'X-Amz-Target': 'AmazonSQS.SendMessage',
      'Content-Type': 'application/x-amz-json-1.0',
    },
  }
  
  const signer = new SignatureV4({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: region,
    service: 'sqs',
    sha256: Sha256,
  });

  const signedRequest = await signer.sign({
    method: options.method,
    headers: options.headers,
    hostname: options.hostname,
    path: options.path,
    protocol: 'https:',
    body: body,
  });

  return Object.assign(options.headers, signedRequest.headers);
}

export async function sendToSqs(config: SqsDestinationConfig, payload: unknown, idempotencyKey?: string) {
  const queueUrl = new URL(config.queueUrl);
  const host = queueUrl.host;
  const region = inferSqsRegion(queueUrl) ?? config.region;

  if (!region) {
    throw new Error("Unable to determine SQS region from queue URL or destination configuration");
  }

  const messageDeduplicationId = config.messageDeduplicationId ?? idempotencyKey ?? crypto.randomUUID();

  const body = JSON.stringify({
    MessageBody: JSON.stringify(payload),
    DelaySeconds: config.delaySeconds,
    MessageGroupId: config.messageGroupId,
    MessageDeduplicationId: config.messageGroupId ? messageDeduplicationId : undefined,
    QueueUrl: queueUrl.toString(),
  });

  const response = await fetch(config.queueUrl, {
    method: 'POST',
    headers: await signRequest(config, host, region, body),
    body,
  });
  

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: responseText,
    requestUrl: response.url
  };
}
