import { supabase } from "./lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const INITIAL_TASKS = [
  { title: "Patient Records Audit", description: "Review and update patient documentation", priority: "High", department: "Clinical Operations", assignee: "Sarah Khan", dueDate: "2026-09-02", status: "Completed", createdAt: "2026-08-31T08:00:00" },
  { title: "Inventory Update", description: "Update medical supply inventory records", priority: "Medium", department: "Operations", assignee: "Ahmed Ali", dueDate: "2026-09-03", status: "In Progress", createdAt: "2026-08-31T08:30:00" },
  { title: "Staff Schedule Review", description: "Review next week's clinic schedules", priority: "Low", department: "Human Resources", assignee: "Maria Khan", dueDate: "2026-09-05", status: "Pending", createdAt: "2026-08-31T09:00:00" },
  { title: "Compliance Documentation", description: "Review outstanding compliance documents", priority: "High", department: "Compliance", assignee: "Sarah Khan", dueDate: "2026-08-30", status: "Blocked", createdAt: "2026-08-31T09:20:00" },
];

const INITIAL_ACTIVITIES = [
  { user: "Sarah", text: "completed Patient Records Audit", createdAt: "2026-09-01T09:00:00" },
  { user: "Ahmed", text: "moved Inventory Update to In Progress", createdAt: "2026-09-01T08:45:00" },
  { user: "Maria", text: "assigned Staff Schedule Review to Ahmed", createdAt: "2026-09-01T08:10:00" },
  { user: "Sarah", text: "created a new compliance task", createdAt: "2026-09-01T07:10:00" },
];

const TEAM_MEMBERS = [
  { name: "Sarah Khan", initials: "SK", capacity: 10 },
  { name: "Ahmed Ali", initials: "AA", capacity: 10 },
  { name: "Maria Khan", initials: "MK", capacity: 12 },
];

const DEPARTMENTS = [
  "Clinical Operations",
  "Operations",
  "Human Resources",
  "Compliance",
  "Administration",
  "IT Support",
];

const STATUS_OPTIONS = ["Pending", "In Progress", "Blocked", "Completed"];

const STATUS_META = {
  Pending: { label: "Pending", className: "status-pending" },
  "In Progress": { label: "In Progress", className: "status-progress" },
  Blocked: { label: "Blocked", className: "status-blocked" },
  Completed: { label: "Completed", className: "status-completed" },
};

const timeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const minutes = Math.floor(
    Math.max(0, Date.now() - date.getTime()) / 60000
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const fromTaskRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || "No description provided",
  priority: ["Low", "Medium", "High"].includes(row.priority)
    ? row.priority
    : "Medium",
  department: row.department || "Clinical Operations",
  assignee: row.assignee || "Sarah Khan",
  dueDate: row.due_date || "",
  status: STATUS_OPTIONS.includes(row.status)
    ? row.status
    : "Pending",
  createdAt: row.created_at,
});

const fromActivityRow = (row) => ({
  id: row.id,
  user: row.user_name || "Sarah",
  text: row.activity_text || "",
  time: timeAgo(row.created_at),
  createdAt: row.created_at,
});

/* =========================================================
   CURRENT USER PROFILE
   ========================================================= */

const getCurrentUserProfile = (session) => {
  const email = session?.user?.email?.toLowerCase() || "";

  const metadata = session?.user?.user_metadata || {};

  const metadataName = (
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    ""
  ).toLowerCase();

  const identity = `${email} ${metadataName}`;

  if (
    identity.includes("sarah") ||
    identity.includes("sara")
  ) {
    return {
      name: "Sarah Khan",
      firstName: "Sarah",
      role: "Manager",
      isManager: true,
    };
  }

  if (identity.includes("ahmed")) {
    return {
      name: "Ahmed Ali",
      firstName: "Ahmed",
      role: "User",
      isManager: false,
    };
  }

  if (identity.includes("maria")) {
    return {
      name: "Maria Khan",
      firstName: "Maria",
      role: "User",
      isManager: false,
    };
  }

  return {
    name: metadata.full_name || session?.user?.email || "User",
    firstName:
      metadata.full_name?.split(" ")[0] ||
      session?.user?.email?.split("@")[0] ||
      "User",
    role: "User",
    isManager: false,
  };
};

const seedDatabaseIfEmpty = async () => {
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id")
    .limit(1);

  if (tasksError) throw tasksError;

  if (!tasks?.length) {
    const { error } = await supabase.from("tasks").insert(
      INITIAL_TASKS.map((task) => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        department: task.department,
        assignee: task.assignee,
        due_date: task.dueDate,
        status: task.status,
        created_at: task.createdAt,
      }))
    );

    if (error) throw error;
  }

  const { data: activities, error: activitiesError } =
    await supabase
      .from("activities")
      .select("id")
      .limit(1);

  if (activitiesError) throw activitiesError;

  if (!activities?.length) {
    const { error } = await supabase.from("activities").insert(
      INITIAL_ACTIVITIES.map((activity) => ({
        user_name: activity.user,
        activity_text: activity.text,
        created_at: activity.createdAt,
      }))
    );

    if (error) throw error;
  }
};

/* =========================================================
   LOGIN PAGE
   ========================================================= */

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(
          loginError.message ||
          "Unable to sign in. Please try again."
        );
      }
    } catch (loginError) {
      console.error("ClinicFlow login error:", loginError);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <img
            src="/src/assets/safex-logo.png"
            alt="SAFEX Solutions"
            className="login-logo"
          />

          <div>
            <h1>ClinicFlow</h1>
            <p>Healthcare Teams</p>
          </div>
        </div>

        <div className="login-heading">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to ClinicFlow</h2>
          <p>
            Manage tasks, team activity, and workload from one place.
          </p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>

          <div className="form-group">
            <label htmlFor="login-email">Email address</label>

            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>

            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="primary-button login-button"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>

        </form>

        <div className="login-footer">
          <span>Secure team workspace</span>
          <span>•</span>
          <span>ClinicFlow</span>
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activePage, setActivePage] = useState("Dashboard");
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "Medium",
    department: "Clinical Operations",
    assignee: "Sarah Khan",
    dueDate: "",
    status: "Pending",
  });

  /* =========================================================
     CURRENT LOGGED-IN USER
     ========================================================= */

  const currentUser = useMemo(
    () => getCurrentUserProfile(session),
    [session]
  );

  /* =========================================================
     AUTH SESSION
     ========================================================= */

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error) {
          console.error("Supabase auth error:", error);
        }

        if (mounted) {
          setSession(data?.session ?? null);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error(
          "ClinicFlow session error:",
          error
        );

        if (mounted) {
          setSession(null);
          setAuthLoading(false);
        }
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "ClinicFlow logout error:",
        error
      );
      return;
    }

    setSession(null);
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      await seedDatabaseIfEmpty();

      const [taskResult, activityResult] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("activities")
            .select("*")
            .order("created_at", {
              ascending: false,
            }),
        ]);

      if (taskResult.error)
        throw taskResult.error;

      if (activityResult.error)
        throw activityResult.error;

      setTasks(
        (taskResult.data || []).map(
          fromTaskRow
        )
      );

      setActivities(
        (activityResult.data || []).map(
          fromActivityRow
        )
      );
    } catch (error) {
      console.error(
        "ClinicFlow Supabase load error:",
        error
      );

      setLoadError(
        "Unable to load ClinicFlow data from Supabase. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  const stats = useMemo(() => {
    const completed = tasks.filter(
      (task) => task.status === "Completed"
    ).length;

    const inProgress = tasks.filter(
      (task) => task.status === "In Progress"
    ).length;

    const overdue = tasks.filter((task) => {
      if (
        task.status === "Completed" ||
        !task.dueDate
      ) {
        return false;
      }

      return (
        new Date(
          `${task.dueDate}T23:59:59`
        ) < new Date()
      );
    }).length;

    return {
      total: tasks.length,
      inProgress,
      completed,
      overdue,
    };
  }, [tasks]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.status !== "Completed" &&
            task.dueDate
        )
        .sort(
          (a, b) =>
            new Date(a.dueDate) -
            new Date(b.dueDate)
        )
        .slice(0, 5),
    [tasks]
  );

  const workload = useMemo(
    () =>
      TEAM_MEMBERS.map((member) => {
        const activeTasks = tasks.filter(
          (task) =>
            task.assignee === member.name &&
            task.status !== "Completed"
        ).length;

        return {
          ...member,
          activeTasks,
          percentage: Math.min(
            Math.round(
              (activeTasks /
                member.capacity) *
                100
            ),
            100
          ),
        };
      }),
    [tasks]
  );

  const showNotification = (
    type,
    message
  ) => {
    setNotification({
      type,
      message,
    });

    window.setTimeout(
      () => setNotification(null),
      3500
    );
  };

  const addActivity = async (
    user,
    text
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from("activities")
      .insert({
        user_name: user,
        activity_text: text,
      })
      .select()
      .single();

    if (error) throw error;

    setActivities((current) => [
      fromActivityRow(data),
      ...current,
    ]);
  };

  const resetNewTask = () =>
    setNewTask({
      title: "",
      description: "",
      priority: "Medium",
      department:
        "Clinical Operations",
      assignee: "Sarah Khan",
      dueDate: "",
      status: "Pending",
    });

  /* =========================================================
     CREATE TASK
     ONLY SARAH / MANAGER
     ========================================================= */

  const handleCreateTask = async (
    event
  ) => {
    event.preventDefault();

    if (!currentUser.isManager) {
      showNotification(
        "warning",
        "Only the manager can create and assign tasks."
      );
      return;
    }

    if (
      !newTask.title.trim() ||
      !newTask.dueDate ||
      !newTask.department ||
      !newTask.assignee ||
      !newTask.status
    ) {
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from("tasks")
        .insert({
          title:
            newTask.title.trim(),
          description:
            newTask.description.trim() ||
            "No description provided",
          priority:
            newTask.priority,
          department:
            newTask.department,
          assignee:
            newTask.assignee,
          due_date:
            newTask.dueDate,
          status:
            newTask.status,
        })
        .select()
        .single();

      if (error) throw error;

      const task =
        fromTaskRow(data);

      setTasks((current) => [
        task,
        ...current,
      ]);

      try {
        const assignedFirstName =
          task.assignee.split(" ")[0];

        await addActivity(
          currentUser.firstName,
          `created ${task.title} and assigned it to ${assignedFirstName}`
        );

        showNotification(
          "success",
          "Task created and assigned successfully."
        );
      } catch (activityError) {
        console.error(
          "Supabase activity log error:",
          activityError
        );

        showNotification(
          "warning",
          "Task created, but the activity log could not be updated."
        );
      }

      resetNewTask();
      setIsModalOpen(false);
      setActivePage("Task Board");
    } catch (error) {
      console.error(
        "Supabase task creation error:",
        error
      );

      showNotification(
        "error",
        "Task could not be created. Please check your connection and try again."
      );
    }
  };

  /* =========================================================
     UPDATE TASK STATUS
     SARAH: ANY TASK
     AHMED/MARIA: ONLY THEIR OWN TASKS
     ========================================================= */

  const updateTaskStatus = async (
    taskId,
    newStatus
  ) => {
    const currentTask =
      tasks.find(
        (task) =>
          task.id === taskId
      );

    if (
      !currentTask ||
      currentTask.status === newStatus
    ) {
      return;
    }

    if (
      !currentUser.isManager &&
      currentTask.assignee !==
        currentUser.name
    ) {
      showNotification(
        "warning",
        "You can only update the status of your assigned tasks."
      );
      return;
    }

    try {
      let query = supabase
        .from("tasks")
        .update({
          status: newStatus,
        })
        .eq("id", taskId);

      if (!currentUser.isManager) {
        query = query.eq(
          "assignee",
          currentUser.name
        );
      }

      const {
        data,
        error,
      } = await query
        .select()
        .single();

      if (error) throw error;

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? fromTaskRow(data)
            : task
        )
      );

      try {
        await addActivity(
          currentUser.firstName,
          `moved ${currentTask.title} from ${currentTask.status} to ${newStatus}`
        );

        showNotification(
          "success",
          `Task status updated to ${newStatus}.`
        );
      } catch (activityError) {
        console.error(
          "Supabase activity log error:",
          activityError
        );

        showNotification(
          "warning",
          "Task status updated, but the activity log could not be updated."
        );
      }
    } catch (error) {
      console.error(
        "Supabase status update error:",
        error
      );

      showNotification(
        "error",
        "Task status could not be updated. Please check your connection and try again."
      );
    }
  };

  const formatDate = (date) =>
    date
      ? new Date(
          `${date}T00:00:00`
        ).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        )
      : "No due date";

  const getTasksByStatus = (
    status
  ) =>
    tasks.filter(
      (task) =>
        task.status === status
    );

  const renderStatusBadge = (
    status
  ) => {
    const meta =
      STATUS_META[status] ||
      STATUS_META.Pending;

    return (
      <span
        className={`status-badge ${meta.className}`}
      >
        <span className="status-dot" />
        {meta.label}
      </span>
    );
  };

  const renderDashboard = () => (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TEAM OVERVIEW
          </p>

          <h1>
            Good morning,{" "}
            {currentUser.firstName} 👋
          </h1>

          <p className="page-subtitle">
            Here's what's happening with
            your healthcare team today.
          </p>
        </div>

        {currentUser.isManager && (
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setIsModalOpen(true)
            }
          >
            + New Task
          </button>
        )}
      </header>

      <section className="stats-grid">
        {[
          [
            "Total Tasks",
            stats.total,
            "Across your team",
          ],
          [
            "In Progress",
            stats.inProgress,
            "Currently active",
          ],
          [
            "Completed",
            stats.completed,
            "Completed tasks",
          ],
          [
            "Overdue",
            stats.overdue,
            "Needs attention",
          ],
        ].map(
          ([label, value, sub]) => (
            <div
              className="stat-card"
              key={label}
            >
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{sub}</small>
            </div>
          )
        )}
      </section>

      <section className="dashboard-grid">

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Upcoming Tasks</h2>
              <p>
                Your team's next priorities
              </p>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() =>
                setActivePage(
                  "Task Board"
                )
              }
            >
              View all
            </button>
          </div>

          <div className="task-list">
            {upcomingTasks.length === 0 ? (
              <div className="empty-state">
                No upcoming tasks.
              </div>
            ) : (
              upcomingTasks.map(
                (task) => (
                  <div
                    className="task-row"
                    key={task.id}
                  >
                    <div className="task-row-content">

                      <div className="task-row-top">
                        <span
                          className={`priority-badge priority-${task.priority.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>

                        {renderStatusBadge(
                          task.status
                        )}
                      </div>

                      <h3>
                        {task.title}
                      </h3>

                      <p>
                        {task.description}
                      </p>

                      <small className="task-department">
                        {task.department}
                      </small>
                    </div>

                    <div className="task-row-meta">
                      <span>
                        👤{" "}
                        {task.assignee.split(
                          " "
                        )[0]}
                      </span>

                      <span>
                        📅{" "}
                        {formatDate(
                          task.dueDate
                        )}
                      </span>
                    </div>

                  </div>
                )
              )
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Recent Activity
              </h2>

              <p>
                Latest team updates
              </p>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() =>
                setActivePage(
                  "Activity"
                )
              }
            >
              View all
            </button>
          </div>

          <div className="activity-list">
            {activities
              .slice(0, 4)
              .map(
                (activity) => (
                  <div
                    className="activity-item"
                    key={activity.id}
                  >
                    <div className="activity-indicator" />

                    <div>
                      <p>
                        <strong>
                          {activity.user}
                        </strong>{" "}
                        {activity.text}
                      </p>

                      <small>
                        {activity.time}
                      </small>
                    </div>
                  </div>
                )
              )}
          </div>
        </div>

      </section>

      <section className="panel workload-preview">
        <div className="panel-header">
          <div>
            <h2>
              Team Workload
            </h2>

            <p>
              Current workload across
              your team
            </p>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={() =>
              setActivePage(
                "Team Workload"
              )
            }
          >
            View details
          </button>
        </div>

        <div className="workload-list">
          {workload.map(
            (member) => (
              <div
                className="workload-row"
                key={member.name}
              >
                <div className="member-profile">
                  <div className="member-avatar">
                    {member.initials}
                  </div>

                  <div>
                    <strong>
                      {member.name}
                    </strong>

                    <span>
                      {member.activeTasks}{" "}
                      active tasks
                    </span>
                  </div>
                </div>

                <div className="workload-progress">
                  <div className="progress-track">
                    <div
                      className="progress-value"
                      style={{
                        width: `${member.percentage}%`,
                      }}
                    />
                  </div>

                  <strong>
                    {member.percentage}%
                  </strong>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </>
  );

  const renderKanbanCard = (
    task
  ) => {
    const canUpdateTask =
      currentUser.isManager ||
      task.assignee ===
        currentUser.name;

    return (
      <article
        className="kanban-card"
        key={task.id}
      >
        <div className="kanban-card-top">
          <span
            className={`priority-badge priority-${task.priority.toLowerCase()}`}
          >
            {task.priority}
          </span>

          <span className="task-id">
            #{task.id}
          </span>
        </div>

        <h3>
          {task.title}
        </h3>

        <p className="kanban-description">
          {task.description}
        </p>

        <div className="kanban-details">

          <div className="kanban-detail">
            <span className="detail-icon">
              👤
            </span>

            <span>
              {task.assignee}
            </span>
          </div>

          <div className="kanban-detail">
            <span className="detail-icon">
              🏢
            </span>

            <span>
              {task.department}
            </span>
          </div>

          <div className="kanban-detail">
            <span className="detail-icon">
              📅
            </span>

            <span>
              {formatDate(
                task.dueDate
              )}
            </span>
          </div>

        </div>

        <div className="kanban-card-footer">

          <label
            htmlFor={`kanban-status-${task.id}`}
          >
            Status
          </label>

          <select
            id={`kanban-status-${task.id}`}
            className="kanban-status-select"
            value={task.status}
            disabled={!canUpdateTask}
            onChange={(event) =>
              updateTaskStatus(
                task.id,
                event.target.value
              )
            }
          >
            {STATUS_OPTIONS.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>

        </div>
      </article>
    );
  };

  const renderTaskBoard = () => (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TASK MANAGEMENT
          </p>

          <h1>
            Task Board
          </h1>

          <p className="page-subtitle">
            Manage and track your team's
            work by status.
          </p>
        </div>

        {currentUser.isManager && (
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setIsModalOpen(true)
            }
          >
            + New Task
          </button>
        )}
      </header>

      <section className="kanban-summary">
        {[
          ["Total", tasks.length],
          [
            "Pending",
            getTasksByStatus(
              "Pending"
            ).length,
          ],
          [
            "In Progress",
            getTasksByStatus(
              "In Progress"
            ).length,
          ],
          [
            "Blocked",
            getTasksByStatus(
              "Blocked"
            ).length,
          ],
          [
            "Completed",
            getTasksByStatus(
              "Completed"
            ).length,
          ],
        ].map(
          ([label, value]) => (
            <div
              className="kanban-summary-item"
              key={label}
            >
              <span>
                {label}
              </span>

              <strong>
                {value}
              </strong>
            </div>
          )
        )}
      </section>

      <section className="kanban-board">
        {STATUS_OPTIONS.map(
          (status) => {
            const meta =
              STATUS_META[status];

            const columnTasks =
              getTasksByStatus(
                status
              );

            return (
              <div
                className={`kanban-column ${meta.className}`}
                key={status}
              >
                <div className="kanban-column-header">

                  <div className="kanban-column-title">
                    <span className="column-status-dot" />

                    <h2>
                      {meta.label}
                    </h2>
                  </div>

                  <span className="column-count">
                    {columnTasks.length}
                  </span>

                </div>

                <div className="kanban-column-body">

                  {columnTasks.length ? (
                    columnTasks.map(
                      renderKanbanCard
                    )
                  ) : (
                    <div className="kanban-empty">
                      <span>
                        +
                      </span>

                      <p>
                        No tasks here
                      </p>
                    </div>
                  )}

                </div>
              </div>
            );
          }
        )}
      </section>
    </>
  );

  const renderActivity = () => (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TEAM TIMELINE
          </p>

          <h1>
            Activity
          </h1>

          <p className="page-subtitle">
            Keep track of the latest team
            actions.
          </p>
        </div>
      </header>

      <section className="panel activity-page-panel">

        <div className="panel-header">
          <div>
            <h2>
              Recent Activity
            </h2>

            <p>
              Latest changes across
              ClinicFlow
            </p>
          </div>
        </div>

        <div className="activity-list activity-page-list">

          {activities.length ? (
            activities.map(
              (activity) => (
                <div
                  className="activity-item"
                  key={activity.id}
                >
                  <div className="activity-indicator" />

                  <div>
                    <p>
                      <strong>
                        {activity.user}
                      </strong>{" "}
                      {activity.text}
                    </p>

                    <small>
                      {activity.time}
                    </small>
                  </div>
                </div>
              )
            )
          ) : (
            <div className="empty-state">
              No activity yet.
            </div>
          )}

        </div>
      </section>
    </>
  );

  const renderWorkload = () => (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TEAM CAPACITY
          </p>

          <h1>
            Team Workload
          </h1>

          <p className="page-subtitle">
            Monitor active work across
            your healthcare team.
          </p>
        </div>
      </header>

      <section className="panel workload-page-panel">

        <div className="panel-header">
          <div>
            <h2>
              Current Workload
            </h2>

            <p>
              Active tasks by team member
            </p>
          </div>
        </div>

        <div className="workload-list workload-page-list">

          {workload.map(
            (member) => (
              <div
                className="workload-row"
                key={member.name}
              >

                <div className="member-profile">

                  <div className="member-avatar">
                    {member.initials}
                  </div>

                  <div>
                    <strong>
                      {member.name}
                    </strong>

                    <span>
                      {member.activeTasks}{" "}
                      active tasks
                    </span>
                  </div>

                </div>

                <div className="workload-progress">

                  <div className="progress-track">
                    <div
                      className="progress-value"
                      style={{
                        width: `${member.percentage}%`,
                      }}
                    />
                  </div>

                  <strong>
                    {member.percentage}%
                  </strong>

                </div>

              </div>
            )
          )}

        </div>
      </section>
    </>
  );

  /* =========================================================
     AUTH LOADING
     ========================================================= */

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-card">
          <h2>
            ClinicFlow
          </h2>

          <p>
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     LOGIN
     ========================================================= */

  if (!session) {
    return <LoginPage />;
  }

  /* =========================================================
     EXISTING DASHBOARD
     ========================================================= */

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="sidebar-brand">

          <img
            src="/src/assets/safex-logo.png"
            alt="SAFEX Solutions"
            className="sidebar-logo"
          />

          <div className="product-brand">
            <h2>
              ClinicFlow
            </h2>

            <span>
              Healthcare Teams
            </span>
          </div>

        </div>

        <nav className="sidebar-navigation">

          {[
            "Dashboard",
            "Task Board",
            "Activity",
            "Team Workload",
          ].map(
            (page) => (
              <button
                key={page}
                type="button"
                className={`navigation-item ${
                  activePage === page
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActivePage(page)
                }
              >
                <span className="navigation-icon">
                  {page === "Dashboard"
                    ? "⌂"
                    : page === "Task Board"
                    ? "▦"
                    : page === "Activity"
                    ? "◷"
                    : "◉"}
                </span>

                <span>
                  {page}
                </span>
              </button>
            )
          )}

        </nav>

        <div className="sidebar-footer">

          <div className="profile">

            <img
              src="/src/assets/safex-icon.jpeg"
              alt={currentUser.name}
              className="profile-avatar"
            />

            <div className="profile-details">

              <strong>
                {currentUser.name}
              </strong>

              <span>
                {currentUser.role}
              </span>

            </div>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
              title="Sign out"
            >
              ↪
            </button>

          </div>

        </div>

      </aside>

      {notification && (
        <div
          className="app-notification"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 2000,
            width:
              "min(420px, calc(100vw - 40px))",
            padding: "14px 16px",
            borderRadius: 12,
            border:
              "1px solid rgba(255,255,255,0.12)",
            background:
              notification.type ===
              "success"
                ? "#123b2d"
                : notification.type ===
                  "warning"
                ? "#3d3215"
                : "#3d1f26",
            color: "#f8fafc",
            boxShadow:
              "0 14px 36px rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 14,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >

          <span>
            {notification.message}
          </span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() =>
              setNotification(null)
            }
            style={{
              border: 0,
              background:
                "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>

        </div>
      )}

      <main className="main-content">

        {isLoading && (
          <div className="empty-state">
            Loading ClinicFlow data...
          </div>
        )}

        {!isLoading &&
          loadError && (
            <div className="empty-state">

              <p>
                {loadError}
              </p>

              <button
                type="button"
                className="primary-button"
                style={{
                  marginTop: 14,
                }}
                onClick={loadData}
              >
                Retry
              </button>

            </div>
          )}

        {!isLoading &&
          !loadError &&
          activePage ===
            "Dashboard" &&
          renderDashboard()}

        {!isLoading &&
          !loadError &&
          activePage ===
            "Task Board" &&
          renderTaskBoard()}

        {!isLoading &&
          !loadError &&
          activePage ===
            "Activity" &&
          renderActivity()}

        {!isLoading &&
          !loadError &&
          activePage ===
            "Team Workload" &&
          renderWorkload()}

      </main>

      {isModalOpen &&
        currentUser.isManager && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setIsModalOpen(
                  false
                );
              }
            }}
          >

            <div className="task-modal">

              <div className="modal-header">

                <div>
                  <p className="eyebrow">
                    TASK MANAGEMENT
                  </p>

                  <h2>
                    Create New Task
                  </h2>

                  <p>
                    Add a new task for your
                    healthcare team.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setIsModalOpen(
                      false
                    )
                  }
                >
                  ×
                </button>

              </div>

              <form
                className="task-form"
                onSubmit={
                  handleCreateTask
                }
              >

                <div className="form-group">

                  <label htmlFor="task-title">
                    Task Title
                  </label>

                  <input
                    id="task-title"
                    type="text"
                    placeholder="e.g. Patient follow-up review"
                    value={
                      newTask.title
                    }
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        title:
                          e.target.value,
                      })
                    }
                    required
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="task-description">
                    Description
                  </label>

                  <textarea
                    id="task-description"
                    placeholder="Describe what needs to be completed..."
                    rows="4"
                    value={
                      newTask.description
                    }
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        description:
                          e.target.value,
                      })
                    }
                  />

                </div>

                <div className="form-grid">

                  <div className="form-group">

                    <label htmlFor="task-priority">
                      Priority
                    </label>

                    <select
                      id="task-priority"
                      value={
                        newTask.priority
                      }
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          priority:
                            e.target.value,
                        })
                      }
                    >
                      <option value="High">
                        High
                      </option>

                      <option value="Medium">
                        Medium
                      </option>

                      <option value="Low">
                        Low
                      </option>
                    </select>

                  </div>

                  <div className="form-group">

                    <label htmlFor="task-department">
                      Department
                    </label>

                    <select
                      id="task-department"
                      value={
                        newTask.department
                      }
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          department:
                            e.target.value,
                        })
                      }
                      required
                    >
                      {DEPARTMENTS.map(
                        (department) => (
                          <option
                            key={
                              department
                            }
                            value={
                              department
                            }
                          >
                            {department}
                          </option>
                        )
                      )}
                    </select>

                  </div>

                </div>

                <div className="form-grid">

                  <div className="form-group">

                    <label htmlFor="task-assignee">
                      Assign To
                    </label>

                    <select
                      id="task-assignee"
                      value={
                        newTask.assignee
                      }
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          assignee:
                            e.target.value,
                        })
                      }
                    >
                      {TEAM_MEMBERS.map(
                        (member) => (
                          <option
                            key={
                              member.name
                            }
                            value={
                              member.name
                            }
                          >
                            {member.name}
                          </option>
                        )
                      )}
                    </select>

                  </div>

                  <div className="form-group">

                    <label htmlFor="task-status">
                      Status
                    </label>

                    <select
                      id="task-status"
                      value={
                        newTask.status
                      }
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          status:
                            e.target.value,
                        })
                      }
                      required
                    >
                      {STATUS_OPTIONS.map(
                        (status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        )
                      )}
                    </select>

                  </div>

                </div>

                <div className="form-group">

                  <label htmlFor="task-due-date">
                    Due Date
                  </label>

                  <input
                    id="task-due-date"
                    type="date"
                    value={
                      newTask.dueDate
                    }
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        dueDate:
                          e.target.value,
                      })
                    }
                    required
                  />

                </div>

                <div className="form-actions">

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      resetNewTask();
                      setIsModalOpen(
                        false
                      );
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    Create Task
                  </button>

                </div>

              </form>

            </div>
          </div>
        )}

    </div>
  );
}

export default App;

