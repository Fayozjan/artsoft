const EditIcon = ({ onClick, size = 20, className }) => (
  <svg
    width={size}
    height={size}
    onClick={onClick}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="none"
      stroke="#000000"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M8.172 19.828L19.828 8.172c.546-.546.818-.818.964-1.112a2 2 0 0 0 0-1.776c-.146-.295-.418-.567-.964-1.112c-.545-.546-.817-.818-1.112-.964a2 2 0 0 0-1.776 0c-.294.146-.566.418-1.112.964L4.172 15.828c-.579.578-.868.867-1.02 1.235C3 17.43 3 17.839 3 18.657V21h2.343c.818 0 1.226 0 1.594-.152c.367-.152.656-.442 1.235-1.02M12 21h6M14.5 5.5l4 4"
    />
  </svg>
);

const DeleteIcon = ({ onClick, size = 19, className }) => (
  <svg
    width={size}
    height={size}
    onClick={onClick}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="none"
      stroke="#000000"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="m19.5 5.5l-.62 10.025c-.158 2.561-.237 3.842-.88 4.763a4 4 0 0 1-1.2 1.128c-.957.584-2.24.584-4.806.584c-2.57 0-3.855 0-4.814-.585a4 4 0 0 1-1.2-1.13c-.642-.922-.72-2.205-.874-4.77L4.5 5.5M3 5.5h18m-4.944 0l-.683-1.408c-.453-.936-.68-1.403-1.071-1.695a2 2 0 0 0-.275-.172C13.594 2 13.074 2 12.035 2c-1.066 0-1.599 0-2.04.234a2 2 0 0 0-.278.18c-.395.303-.616.788-1.058 1.757L8.053 5.5"
      color="currentColor"
    />
  </svg>
);

export const TableIcons = {
  edit: EditIcon,
  delete: DeleteIcon,
};

export default TableIcons;
