import NavGroupGlobal from './Global'
import styles from "../../sidebar.module.scss"
import NavGroupProjects from './Projects'

interface NavGroupProps {
    isAdminRoute: boolean
}

function NavGroup({isAdminRoute = false}:NavGroupProps) {
  return (
    <div className={styles.navGroup}>
      <NavGroupGlobal/>
      <NavGroupProjects/>
    </div>
  )
}

export default NavGroup