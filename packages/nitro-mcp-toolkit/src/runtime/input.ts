import {
  canRequestInput as engineCanRequestInput,
  defineRequestState as engineDefineRequestState,
  getElicitedContent as engineGetElicitedContent,
  getInputResponses as engineGetInputResponses,
  getMissingInputs as engineGetMissingInputs,
  getSupportedInputs as engineGetSupportedInputs,
  inputRequired as engineInputRequired,
} from 'h3-mcp'
import type { H3Event } from 'h3/generic'
import type {
  ElicitContent,
  ElicitedContentFor,
  InputRequest,
  InputRequestMap,
  InputRequiredResult,
  InputRequiredSpec,
  InputResponsesFor,
  RequestStateOptions as EngineRequestStateOptions,
} from 'h3-mcp'

// Keep the engine functions themselves while preventing Nuxt's H3 v1 alias
// from changing the event types in their public declarations.
export const canRequestInput: (event: H3Event, request: InputRequest) => boolean =
  engineCanRequestInput

export const inputRequired: (event: H3Event, spec: InputRequiredSpec) => InputRequiredResult =
  engineInputRequired

export const getInputResponses: <TRequests extends InputRequestMap>(
  event: H3Event,
  requests: TRequests,
) => InputResponsesFor<TRequests> = engineGetInputResponses

export const getMissingInputs: <TRequests extends InputRequestMap>(
  event: H3Event,
  requests: TRequests,
) => Partial<TRequests> = engineGetMissingInputs

export const getSupportedInputs: <TRequests extends InputRequestMap>(
  event: H3Event,
  requests: TRequests,
) => Partial<TRequests> = engineGetSupportedInputs

export const getElicitedContent: {
  <TRequests extends InputRequestMap, TKey extends keyof TRequests & string>(
    event: H3Event,
    requests: TRequests,
    key: TKey,
  ): ElicitedContentFor<TRequests[TKey]> | undefined
  <T = ElicitContent>(event: H3Event, key: string): T | undefined
} = engineGetElicitedContent

interface RequestStateOptions extends Omit<EngineRequestStateOptions, 'bind'> {
  bind?: (event: H3Event) => string
}

interface RequestStateCodec<T> {
  seal(payload: T, event?: H3Event): Promise<string>
  open(event: H3Event): Promise<T | undefined>
}

export const defineRequestState: <T = unknown>(
  options: RequestStateOptions,
) => RequestStateCodec<T> = engineDefineRequestState
