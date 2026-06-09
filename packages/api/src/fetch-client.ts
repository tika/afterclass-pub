export type FetchMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Error thrown when an authenticated request is attempted but no token is available.
 * This typically happens during app startup when auth state is still initializing.
 * Unlike a 401, this should not trigger a sign-out - just retry later.
 */
export class AuthNotReadyError extends Error {
  constructor(message = "Authentication token not yet available") {
    super(message);
    this.name = "AuthNotReadyError";
  }
}

export async function fetchClient<T>(
  method: FetchMethod,
  url: string,
  body?: unknown,
  token?: string,
  options?: {
    /** Suppress token warning for public endpoints */
    suppressTokenWarning?: boolean;
  },
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (!options?.suppressTokenWarning) {
    console.warn(`[fetchClient] No token provided for ${method} ${url}`);
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData: unknown;

    try {
      errorData = await response.json();
      if (
        errorData &&
        typeof errorData === "object" &&
        "message" in errorData &&
        typeof errorData.message === "string"
      ) {
        errorMessage = errorData.message;
      } else if (
        errorData &&
        typeof errorData === "object" &&
        "error" in errorData &&
        typeof errorData.error === "string"
      ) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore JSON parse error
    }

    throw new ApiError(response.status, errorMessage, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
