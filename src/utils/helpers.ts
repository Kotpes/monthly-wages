import differenceInHours from 'date-fns/difference_in_hours'
import differenceInMinutes from 'date-fns/difference_in_minutes'
import format from 'date-fns/format'
import getHours from 'date-fns/get_hours'

export type Shift = {
  'Person Name': string,
  'Person ID': string,
  Date: string,
  Start: string,
  End: string,
}

export type Employee = {
  employeeId: string,
  employeeName: string,
  monthlyWage: string,
  monthlyOvertime: number,
  monthlyHours: number
}

// TODO: Move helper functions into it's own file
const normalizeTime = (timeString: string) => {
  const splitTime = timeString.split(':')
  const hours = parseInt(splitTime[0], 10) < 10 ? `0${splitTime[0]}` : splitTime[0]
  const minutes = splitTime[1]

  return `${hours}:${minutes}`
}

export const currencyFormatter = (locale: string, currency: string) => {
  return new Intl.NumberFormat(locale, {
    currency,
    minimumFractionDigits: 2,
    style: 'currency'
  })
}

export const getOvertimeWageRate = (overtimeHours: number, baseRate: number) => {
  const hours = []
  let rate = 0
  for (let i = 1; i <= overtimeHours; i++) {
    hours.push(i)
  }

  if (hours.length <= 3) {
    //Overtime is 3 hours or less
    rate = overtimeHours * (baseRate + (baseRate * 0.25))
  } else {
    let hoursLeft = overtimeHours - 3
    //First, calculate rate for the first 3 hours
    rate += 3 * ( baseRate + (baseRate * 0.25))
    if (hoursLeft > 1) {
      //Calculate rate for the next hour and hours after      
      rate += baseRate * 0.5
      hoursLeft - 1
      rate += hoursLeft * (baseRate + baseRate)
    } else {
      //Case where total overtime was 4 hours
      rate += baseRate * 0.5
    }
  }

  return rate
}

/**
 * endDateTime/startdate format: 2014-03-04T16:30
 */
export const calculateDailyWage = (endDateTime: string, startDayTime: string, hoursWorked: number) => {

  // Calculate regular hours pay
  const startingHour = getHours(startDayTime)
  const endingHour = getHours(endDateTime)
  const baseRate = 4.25
  const eveningWorkRate = baseRate + 1.25

  let regularDailyHours = hoursWorked
  let eveningBeforeSix = 0
  let eveningAfterSeven = 0
  let overtimeCompensation = 0
  let overtimeHours = 0

  // Overtime case
  if (hoursWorked > 8) {
    overtimeHours = hoursWorked - 8
    overtimeCompensation = getOvertimeWageRate(overtimeHours, baseRate) * baseRate
  }

  // Case where shift starts before 6
  if (startingHour < 6) {
    if (endingHour < 6) {
      eveningBeforeSix = endingHour - startingHour
      regularDailyHours -= eveningBeforeSix
    } else {
      eveningBeforeSix = 6 - startingHour
      regularDailyHours -= eveningBeforeSix
    }
  }

  // Case where shift ends afer 19
  if (endingHour > 18) {
    // Case where shift starts during evening work compensation hours
    if (startingHour > 18) {
      eveningAfterSeven = endingHour - startingHour
      regularDailyHours -= eveningAfterSeven
    } else {
      eveningAfterSeven = endingHour - 19
      regularDailyHours -= eveningAfterSeven
    }
  }

  const eveningHours = eveningBeforeSix + eveningAfterSeven
  const eveningWorkCompensation = eveningHours !== 0 ? (eveningHours * eveningWorkRate) : 0
  const regularDailyWage = regularDailyHours * baseRate
  const compensationForTheShift = Math.round((regularDailyWage + eveningWorkCompensation + overtimeCompensation) * 100) / 100

  return {compensationForTheShift, overtimeHours}
}

export const handleData = (shifts: Array<Shift>) => {
  // Get list on unique employee id
  const uniqueIDs = [...new Set(shifts.map(shift => shift['Person ID']))]

  const employeeData: Array<Employee> = []

  uniqueIDs.forEach(id => {
    // Getting all the shifts for each employee
    const employeeShifts = shifts.filter(shift => {
      return shift['Person ID'] === id
    })

    const monthlyTotalWage: Array<number> = []
    const monthlyTotalOvertimeHours: Array<number> = []
    const monthlyTotalHours: Array<number> = []

    employeeShifts.forEach(({Date: shiftDate, Start: shiftStart, End: shiftEnd}) => {
      const splitDate = shiftDate.split('.')
      const year = splitDate[2]
      const month = parseInt(splitDate[1], 10) < 10 ? `0${splitDate[1]}` : splitDate[1]
      const day = parseInt(splitDate[0], 10) < 10 ? `0${splitDate[0]}` : splitDate[0]

      const startTime = normalizeTime(shiftStart)
      const endTime = normalizeTime(shiftEnd)

      const startDayTime = format(`${year}-${month}-${day}T${startTime}`, 'YYYY-MM-DDTHH:mm')

      // At first, assume that shift starts and ends on the same date
      let endDateTime = format(`${year}-${month}-${day}T${endTime}`, 'YYYY-MM-DDTHH:mm')

      const shiftEndsNextDay = differenceInHours(endDateTime, startDayTime) < 0

      //Move endDateTime to the next date if shift ends next day
      if (shiftEndsNextDay) {
        const nextDay = parseInt(day, 10) + 1
        endDateTime = format(`${year}-${month}-${nextDay}T${endTime}`, 'YYYY-MM-DDTHH:mm')
      }

      const hoursWorked = differenceInMinutes(endDateTime, startDayTime) / 60
      const regularDailyWage = calculateDailyWage(endDateTime, startDayTime, hoursWorked)

      monthlyTotalWage.push(regularDailyWage.compensationForTheShift)
      monthlyTotalOvertimeHours.push(regularDailyWage.overtimeHours)
      monthlyTotalHours.push(hoursWorked)
    })

    const monthlyWage = monthlyTotalWage.reduce((acc, cur) => acc + cur)
    const monthlyOvertime = monthlyTotalOvertimeHours.reduce((acc, cur) => acc + cur)
    const monthlyHours = monthlyTotalHours.reduce((acc, cur) => acc + cur)
    // console.log(employeeShifts[0]['Person Name'], monthlyTotalHours)

    employeeData.push({
      employeeId: id,
      employeeName: employeeShifts[0]['Person Name'],
      monthlyWage: currencyFormatter('en-US', 'USD').format(monthlyWage),
      monthlyOvertime,
      monthlyHours
    })
  })

  //Sorting in ascending order
  employeeData.sort((a,b) => {
    return parseInt(a.employeeId, 10) - parseInt(b.employeeId, 10)
  })

  return employeeData
}
