import NavGroupGlobal from './Global'
import styles from "../../sidebar.module.scss"
import NavGroupProjects from './Projects'
import NavGroupWorkspace from './Workspace'
import NavGroupAdmin from './Admin'

interface NavGroupProps {
    isAdminRoute: boolean
}

function NavGroup({isAdminRoute = true}:NavGroupProps) {
  return (
    <div className={styles.navGroup}>
      {!isAdminRoute && <>
      <NavGroupGlobal/>
      <NavGroupProjects/>
      <NavGroupWorkspace/>
      </>}
      {isAdminRoute && <NavGroupAdmin/>}
    </div>
  )
}

export default NavGroup