import { useEffect, useState } from "react";
import axios from "axios";

export function useReferenceData({
  accessLevel,
  userBranchId,
  userDepId,
  accessBranches,
  accessDepartments,
}) {
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [branchesRes, departmentsRes, usersRes, positionsRes] =
          await Promise.all([
            axios.get("/api/branch"),
            axios.get("/api/departments"),
            axios.get("/api/users/get"),
            axios.get("/api/position"),
          ]);

        let filteredBranches = branchesRes.data.data;
        let filteredDepartments = departmentsRes.data.data;
        let filteredUsers = usersRes.data.data;

        if (accessLevel === "branch") {
          filteredDepartments = filteredDepartments.filter(
            (dep) => dep.branch_id === Number(userBranchId)
          );
          const departmentIds = filteredDepartments.map((dep) => dep.id);
          filteredBranches = filteredBranches.filter(
            (branch) => branch.id === Number(userBranchId)
          );
          filteredUsers = filteredUsers.filter((user) =>
            departmentIds.includes(user.department_id)
          );
        } else if (accessLevel === "multi-branch") {
          filteredDepartments = filteredDepartments.filter((dep) =>
            accessBranches.includes(dep.branch_id)
          );
          const departmentIds = filteredDepartments.map((dep) => dep.id);
          filteredBranches = filteredBranches.filter((branch) =>
            accessBranches.includes(branch.id)
          );
          filteredUsers = filteredUsers.filter((user) =>
            departmentIds.includes(user.department_id)
          );
        } else if (accessLevel === "department") {
          filteredDepartments = filteredDepartments.filter(
            (dep) => dep.id === Number(userDepId)
          );
          filteredUsers = filteredUsers.filter(
            (user) => user.department_id === Number(userDepId)
          );
        } else if (accessLevel === "multi-department") {
          filteredDepartments = filteredDepartments.filter((dep) =>
            accessDepartments.includes(dep.id)
          );
          filteredUsers = filteredUsers.filter((user) =>
            accessDepartments.includes(user.department_id)
          );
        }

        setBranches(filteredBranches);
        setDepartments(filteredDepartments);
        setUsers(filteredUsers);
        setPositions(positionsRes.data.data);
      } catch (err) {
        console.error("Ошибка загрузки данных:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessLevel, userBranchId, userDepId, accessBranches, accessDepartments]);

  return { branches, departments, users, positions, loading };
}
