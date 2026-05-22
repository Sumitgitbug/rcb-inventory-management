import Modal from "@/components/Modal"
import INotePrintableA4 from "@/components/INotePrintableA4"

function INotePreviewModal({ open, note, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? note.noteId : "I-Note Preview"}
      description=""
      widthClass="max-w-[220mm]"
    >
      <INotePrintableA4 note={note} />
    </Modal>
  )
}

export default INotePreviewModal
  