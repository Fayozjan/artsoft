-- CreateTable
CREATE TABLE "public"."branches" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "status" BOOLEAN NOT NULL DEFAULT true,
    "branch_id" INTEGER NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."doors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "doors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "event_type" VARCHAR(50),
    "event_date" DATE,
    "branch_id" INTEGER,
    "department_id" INTEGER,
    "position_id" INTEGER,
    "order_number" VARCHAR(100),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" SERIAL NOT NULL,
    "employee_number" INTEGER,
    "surname" TEXT,
    "name" TEXT,
    "patronymic" VARCHAR(255),
    "date_of_birth" DATE,
    "gender" VARCHAR(255),
    "place_of_birth" VARCHAR(255),
    "passport" VARCHAR(255),
    "passport_given_date" DATE,
    "passport_validity_period" DATE,
    "pinfl" VARCHAR(255),
    "nationality" VARCHAR(255),
    "education" VARCHAR(255),
    "family" VARCHAR(255),
    "telephone" VARCHAR(255),
    "email" VARCHAR(255),
    "address" VARCHAR(255),
    "branch_id" INTEGER,
    "order_number" VARCHAR(255),
    "date_of_employment" DATE,
    "date_of_dismissal" DATE,
    "status" VARCHAR(255),
    "photo" VARCHAR(255),
    "department_id" INTEGER,
    "position_id" INTEGER,
    "door" INTEGER[],
    "work_schedule_id" INTEGER,
    "education_specialty" VARCHAR(500),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."face_devices" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100),
    "door_id" INTEGER NOT NULL,
    "device_ip" VARCHAR(50) NOT NULL,
    "port" INTEGER DEFAULT 80,
    "direction" VARCHAR(10),
    "status" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."face_passes" (
    "id" SERIAL NOT NULL,
    "event_time" TIMESTAMPTZ(6) NOT NULL,
    "employee_name" VARCHAR(255) NOT NULL,
    "identifier" VARCHAR(50) NOT NULL,
    "event_photo" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "door_name" VARCHAR(255),
    "employee_id" INTEGER NOT NULL,
    "door_id" INTEGER,

    CONSTRAINT "face_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."holidays" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "creator_id" INTEGER NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."positions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refresh_token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."telegram_bots" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "chat_id" INTEGER NOT NULL,
    "users" INTEGER[],
    "status" BOOLEAN DEFAULT true,
    "receive_late_report" BOOLEAN,
    "receive_event_alerts" BOOLEAN,
    "receive_attendance_report" BOOLEAN,

    CONSTRAINT "telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."time_off" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "date_from" TIMESTAMPTZ(6) NOT NULL,
    "date_to" TIMESTAMPTZ(6) NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "is_company_paid" BOOLEAN NOT NULL DEFAULT false,
    "type" VARCHAR(10) NOT NULL DEFAULT 'hour',
    "credited_hours" INTEGER DEFAULT 0,

    CONSTRAINT "time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timesheet" (
    "id" SERIAL NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "day" INTEGER,
    "worked_hours" VARCHAR,
    "intervals" TEXT[],
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "employee_id" INTEGER,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "access_level" TEXT,
    "departments" INTEGER[],
    "branches" INTEGER[],
    "language" TEXT NOT NULL DEFAULT 'ru',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "sidebar" TEXT NOT NULL DEFAULT 'opened',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menus" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "path" VARCHAR(255),
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_menu_access" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_update" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_menu_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_schedules" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" BOOLEAN DEFAULT true,
    "first_shift_start" TIME(6),
    "first_shift_end" TIME(6),
    "second_shift_start" TIME(6),
    "second_shift_end" TIME(6),
    "third_shift_start" TIME(6),
    "third_shift_end" TIME(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "grace_period" interval,
    "shift_type" VARCHAR,
    "shift_start" TIME(6),
    "shift_end" TIME(6),
    "break_minutes" INTEGER,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doors_name_key" ON "public"."doors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "public"."employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_pinfl_key" ON "public"."employees"("pinfl");

-- CreateIndex
CREATE UNIQUE INDEX "face_passes_identifier_key" ON "public"."face_passes"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "public"."positions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_name_key" ON "public"."telegram_bots"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_employee_id_idx" ON "public"."users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_employee_per_user" ON "public"."users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "menus_name_key" ON "public"."menus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_menu_access_user_id_menu_id_key" ON "public"."user_menu_access"("user_id", "menu_id");

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_history" ADD CONSTRAINT "employee_history_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_history" ADD CONSTRAINT "employee_history_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_history" ADD CONSTRAINT "employee_history_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_history" ADD CONSTRAINT "employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."face_devices" ADD CONSTRAINT "face_devices_door_id_fkey" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."face_passes" ADD CONSTRAINT "face_passes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."holidays" ADD CONSTRAINT "holidays_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_off" ADD CONSTRAINT "time_off_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_off" ADD CONSTRAINT "time_off_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_menu_access" ADD CONSTRAINT "user_menu_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_menu_access" ADD CONSTRAINT "user_menu_access_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
