import { http } from "@google-cloud/functions-framework";
import { createProxyRelayHandler } from "hookhq-proxy-relay";

http("relay", createProxyRelayHandler());
