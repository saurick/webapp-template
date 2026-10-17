export async function importWithRetry(importer, retryCount = 1) {
  let lastError

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await importer()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}
