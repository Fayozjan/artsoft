import { useTranslation } from "react-i18next";
import { useEffect } from "react";

import { useAuthStore } from "../stores/authStore";

import styles from "./SearchBtn.module.scss";

const SearchBtn = ({ data = [] }) => {
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  return (
    <div className={styles.search_btn}>
      <button>
        {t("search")}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="200"
          height="200"
          viewBox="0 0 1024 1024"
        >
          <path d="M1014.64 969.04L703.71 656.207c57.952-69.408 92.88-158.704 92.88-256.208c0-220.912-179.088-400-400-400s-400 179.088-400 400s179.088 400 400 400c100.368 0 192.048-37.056 262.288-98.144l310.496 312.448c12.496 12.497 32.769 12.497 45.265 0c12.48-12.496 12.48-32.752 0-45.263zM396.59 736.527c-185.856 0-336.528-150.672-336.528-336.528S210.734 63.471 396.59 63.471c185.856 0 336.528 150.672 336.528 336.528S582.446 736.527 396.59 736.527z" />
        </svg>
      </button>
      {data?.length === 0 && (
        <svg
          className={styles.arrow_button}
          enable-background="new 0 0 99.176 99.176"
          height="99.176px"
          id="Layer_1"
          version="1.1"
          viewBox="0 0 99.176 99.176"
          width="99.176px"
          xml:space="preserve"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
        >
          <g>
            <circle
              cx="40.444"
              cy="16.681"
              fill="#FFFFFF"
              r="12.306"
              stroke="#939598"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-miterlimit="10"
              stroke-width="1.3674"
            />
            <circle
              cx="40.444"
              cy="16.681"
              fill="#FFFFFF"
              r="9"
              stroke="#939598"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-miterlimit="10"
            />
            <path
              d="M73.914,41.707   c-2.299,0-4.178,1.878-4.178,4.178v9.908c0,0.755-0.622,1.384-1.384,1.384c-0.779,0-1.405-0.629-1.405-1.384V41.885   c0-2.313-1.864-4.178-4.178-4.178c-2.299,0-4.174,1.864-4.174,4.178V53c0,0.766-0.629,1.384-1.388,1.384   c-0.776,0-1.405-0.618-1.405-1.384V34.74c0-2.3-1.864-4.174-4.18-4.174c-2.311,0-4.175,1.874-4.175,4.174V53   c0,0.766-0.626,1.384-1.403,1.384c-0.759,0-1.387-0.618-1.387-1.384V17.438c0-2.313-1.877-4.178-4.177-4.178   c-2.312,0-4.176,1.864-4.176,4.178v49.496l-5.65-7.732c-1.672-2.568-4.939-3.439-7.333-1.953c-2.383,1.504-2.968,4.801-1.32,7.372   c0,0,9.102,13.771,12.983,19.663c3.876,5.905,10.165,10.519,21.923,10.519c19.459,0,21.201-15.022,21.201-19.513V45.885   C78.109,43.585,76.228,41.707,73.914,41.707z"
              fill="#FFFFFF"
              stroke="#58595B"
              stroke-miterlimit="10"
              stroke-width="3.4835"
            />
            <path
              d="M73.914,41.707   c-2.299,0-4.178,1.878-4.178,4.178v9.908c0,0.755-0.622,1.384-1.384,1.384c-0.779,0-1.405-0.629-1.405-1.384V41.885   c0-2.313-1.864-4.178-4.178-4.178c-2.299,0-4.174,1.864-4.174,4.178V53c0,0.766-0.629,1.384-1.388,1.384   c-0.776,0-1.405-0.618-1.405-1.384V34.74c0-2.3-1.864-4.174-4.18-4.174c-2.311,0-4.175,1.874-4.175,4.174V53   c0,0.766-0.626,1.384-1.403,1.384c-0.759,0-1.387-0.618-1.387-1.384V17.438c0-2.313-1.877-4.178-4.177-4.178   c-2.312,0-4.176,1.864-4.176,4.178v49.496l-5.65-7.732c-1.672-2.568-4.939-3.439-7.333-1.953c-2.383,1.504-2.968,4.801-1.32,7.372   c0,0,9.102,13.771,12.983,19.663c3.876,5.905,10.165,10.519,21.923,10.519c19.459,0,21.201-15.022,21.201-19.513V45.885   C78.109,43.585,76.228,41.707,73.914,41.707z"
              fill="#FFFFFF"
              stroke="#58595B"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-miterlimit="10"
            />
          </g>
        </svg>
      )}
    </div>
  );
};

export default SearchBtn;
