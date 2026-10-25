const DELETE_DOCUMENT = graphql(`
  mutation DeleteDocument($input: DeleteDocumentInput!) {
    deleteDocument(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

type Pdf = { id: number; fileName: string; sentAt?: string | null }

// Deleting a listing's current unsent PDF (CV or cover letter), confirmed first. A deleted id stays
// hidden until the listing's documents are refetched, so the old PDF never shows again meanwhile.
// `done` runs after every attempt, so the caller can refresh what it shows.
export const useDeleteDocument = (done: (deletedId: number | null) => unknown) => {
  const { run, loading: deleting } = useMutation()
  const toastSuccess = useSuccessToast()
  const target = ref<{ id: number; fileName: string } | null>(null)
  const deletedIds = ref<number[]>([])

  const confirmOpen = computed({
    get: () => !!target.value,
    set: (value) => {
      if (!value) target.value = null
    }
  })
  // A sent PDF is part of the application record, so it can't be deleted.
  const ask = (pdf: Pdf | null | undefined) => {
    if (pdf && !pdf.sentAt) target.value = { id: pdf.id, fileName: pdf.fileName }
  }
  const isDeleted = (id: number) => deletedIds.value.includes(id)

  const confirm = async () => {
    const pdf = target.value
    if (!pdf) return
    const ok = await run(
      async () => (await gql(DELETE_DOCUMENT, { input: { id: pdf.id } })).deleteDocument.errors
    )
    target.value = null
    if (ok) {
      deletedIds.value = [...deletedIds.value, pdf.id]
      toastSuccess('PDF deleted')
    }
    await done(ok ? pdf.id : null)
  }

  return { target, confirmOpen, deleting, ask, confirm, isDeleted }
}
