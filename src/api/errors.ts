import { ORPCError } from '@orpc/client'

export const apiErrorMessage = (error: Error): string => {
  if (error instanceof ORPCError && error.code === 'BAD_REQUEST') {
    const issues = error.data?.issues
    if (Array.isArray(issues) && typeof issues[0]?.message === 'string') {
      return issues[0].message
    }
  }
  return error.message
}
