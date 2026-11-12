import { ERROR_MESSAGES } from '~/constants/errorMessages'

const DELETE_LISTING = graphql(`
  mutation DeleteListing($id: Int!) {
    deleteListing(input: { id: $id }) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

// The API only allows this while a listing is SAVED; its message explains a refusal.
export const useDeleteListing = () => {
  const notify = useAppToast()
  const deleting = ref(false)
  // Returns whether the listing was deleted, so callers only update their state on success.
  const remove = async (id: number) => {
    deleting.value = true
    try {
      const { deleteListing } = await gql(DELETE_LISTING, { id })
      if (deleteListing.errors?.length) {
        notify.error(deleteListing.errors.map((e) => e.message).join(' '))
        return false
      }
      return true
    } catch {
      notify.error(ERROR_MESSAGES.generic)
      return false
    } finally {
      deleting.value = false
    }
  }
  return { remove, deleting }
}
