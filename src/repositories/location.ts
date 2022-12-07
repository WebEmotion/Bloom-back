import { getRepository, createQueryBuilder } from 'typeorm'
import { ErrorResponse } from '../errors/ErrorResponse'
import { Location } from '../entities/Locantions'
import { Room } from '../entities/Rooms'
import { Schedule } from '../entities/Schedules'
import { AdminLocationSchema, LocationSchema } from '../interfaces/location';
import { Instructor } from '../entities/Instructors';
import { User } from '../entities/Users';
import { Seat } from '../entities/Seats'
import { Booking } from '../entities/Bookings'

import moment = require('moment')
moment.locale('es-mx')


export const LocationRepository = {
    async getLocation(locationId: number) {
        const location = await getRepository(Location).findOne({
            where: {
                id: locationId
            },
            relations: ['Room']
        })
        if (!location) throw new ErrorResponse(404, 12, 'La locación no existe')
        return location
    },

    async getAllLocations() {
        const locations = await getRepository(Location).find({})
        return locations
    },

    async getLocationsByWeek(room_id: number, data: LocationSchema, user: User) {
        let startDate
        let endDate
        let days
        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Check if is Sunday (0) or Saturday (6) */
        if(moment(data.start).day() === 0 || moment(data.start).day() === 6) {
            console.log("0-6 true")
            /* Check if is Saturday */
            if(moment(data.start).day() === 6) {
                console.log("6 true")
                /* Check if there are classes to take */
                const scheduleExist = await createQueryBuilder(Schedule)
                    .where('Date(date)>=:cDate', { cDate: moment(data.start).format('YYYY-MM-DD') })
                    .andWhere('Date(date)<:cuDate', { cuDate: moment(data.start).add(1, 'days').format('YYYY-MM-DD') })
                    .andWhere('Time(end)>:cTime', { cTime: moment(data.start).format("HH:mm:ss") })
                    .getOne()

                if(!scheduleExist) {
                    console.log("exist 6")
                    startDate = moment(data.start).add(1, 'days').day(0)
                    days = [[], [], [], [], [], [], [], []]
                    
                    /* Check if is diferent year */
                    if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())
    
                    endDate = moment(startDate).add(8, 'days')
                } else {
                    console.log("no exist 6")
                    startDate = moment(data.start).day(1)
                    days = [[], [], [], [], [], [], []]
                    
                    /* Check if is diferent year */
                    if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

                    endDate = moment(startDate).add(7, 'days')
                }

            } else {
                console.log("6 false")
                startDate = moment(data.start).day(0)
                days = [[], [], [], [], [], [], [], []]
                
                /* Check if is diferent year */
                if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

                endDate = moment(startDate).add(8, 'days')
            }
        } else {
            console.log("0-6 false")
            startDate = moment(data.start).day(1)
            days = [[], [], [], [], [], [], []]
            
            /* Check if is diferent year */
            if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

            endDate = moment(startDate).add(7, 'days')
        }

        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Get room schedules */
        let room = await getRepository(Room).find({
            relations: ['Schedules', 'Schedules.Instructor', 'Schedules.Booking', 'Schedules.Rooms']
        })
        let roomSchedules
        if(days.length === 7) {
            roomSchedules = await createQueryBuilder(Room)
                .leftJoinAndSelect("Room.Schedules", "Schedules")
                .leftJoinAndSelect("Schedules.Instructor", "Instructor")
                .leftJoinAndSelect("Schedules.Rooms", "Rooms")
                .where('Date(Schedules.date)>=:cDate', { cDate: moment(startDate).format('YYYY-MM-DD') })
                .andWhere('Date(Schedules.date)<:cuDate', { cuDate: moment(endDate).format('YYYY-MM-DD') })
                .orderBy("Schedules.date", "ASC")
                .addOrderBy("Schedules.start", "ASC")
                .getMany()
        } else {
            roomSchedules = await createQueryBuilder(Room)
                .leftJoinAndSelect("Room.Schedules", "Schedules")
                .leftJoinAndSelect("Schedules.Instructor", "Instructor")
                .leftJoinAndSelect("Schedules.Rooms", "Rooms")
                .where('Date(Schedules.date)>=:cDate', { cDate: moment(startDate).format('YYYY-MM-DD') })
                .andWhere('Date(Schedules.date)<:cuDate', { cuDate: moment(endDate).format('YYYY-MM-DD') })
                .orderBy("Schedules.date", "ASC")
                .addOrderBy("Schedules.start", "ASC")
                .getMany()
        }

        if(!room) throw new ErrorResponse(404, 12, 'La sala no existe')
        if(!roomSchedules) throw new ErrorResponse(404, 12, 'La sala no existe')

        /* Is room schedule private */
        if (user) {
            if (!user.isAdmin) {
                for (var i in roomSchedules) {
                    for (var j in roomSchedules[i].Schedules) {
                        if (roomSchedules[i].Schedules[j].isPrivate) {
                            delete roomSchedules[i].Schedules[j]
                        }
                    }
                }
            }
        } else {
            for (var i in roomSchedules) {
                for (var j in roomSchedules[i].Schedules) {
                    if (roomSchedules[i].Schedules[j].isPrivate) {
                        delete roomSchedules[i].Schedules[j]
                    }
                }
            }
        }

        /* Delete fields usless and check disponibility by room schedule */
        let filteredSchedules = []
        for (var i in roomSchedules) {
            const roomSchedule = roomSchedules[i] as Room
            const seats = await createQueryBuilder(Seat)
                .where('isActive =:isActive', { isActive: 1 })
                .getCount()
            
            
            for (var j in roomSchedule.Schedules) {
                const bookings = await createQueryBuilder(Booking)
                    .where('Booking.schedules_id =:scheduleId', { scheduleId: roomSchedule.Schedules[j].id })
                    .getCount()
                
                const available = seats - bookings
                
                let soldout = false
                if (available == 0) soldout = true

                delete roomSchedule.Schedules[j].Instructor.createdAt
                delete roomSchedule.Schedules[j].Instructor.profilePicture
                delete roomSchedule.Schedules[j].Instructor.largePicture
                delete roomSchedule.Schedules[j].Instructor.email
                delete roomSchedule.Schedules[j].Instructor.password
                delete roomSchedule.Schedules[j].Instructor.isDeleted


                filteredSchedules.push({
                    ...roomSchedule.Schedules[j],
                    available: available,
                    occupied: bookings,
                    soldOut: soldout
                })
            }
        }

        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Separate registers per day */
        var date = moment(startDate).format("YYYY-MM-DD")
        for(var i in days) {
            for(var j in filteredSchedules) {
                const filteredSchedule = filteredSchedules[j]
                const dateRoom = moment(filteredSchedule.date).format("YYYY-MM-DD")

                if(dateRoom === date) {
                    days[i].push(filteredSchedule)
                }
            }

            date = moment(startDate).add((parseInt(i) + 1), 'days').format("YYYY-MM-DD")
        }

        /* let temp = 0
        let flag = false
        if (days.length === 8) {
            for (var i in days[0]) {
                if (moment(data.start).format('YYYY-MM-DD') !== moment(days[0][i].date).format('YYYY-MM-DD')) {
                    if (!flag) {
                        temp = parseInt(i)
                        flag = true
                    }
                    days[7].push(days[0][i])
                }
            }
            days[0].splice(temp, days[7].length)
        } */

        return days
    },

    async getClientLocationsByWeek(room_id: number, data: LocationSchema, user: User) {
        const client = await getRepository(User).findOne({
            where: {
                id: user.id,
                isDeleted: false
            }
        })

        if (!client) throw new ErrorResponse(404, 13, 'Usuario no existe')

        let startDate
        let endDate
        let days
        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Check if is Sunday (0) or Saturday (6) */
        if(moment(data.start).day() === 0 || moment(data.start).day() === 6) {
            console.log("0-6 true")
            /* Check if is Saturday */
            if(moment(data.start).day() === 6) {
                console.log("6 true")
                /* Check if there are classes to take */
                const scheduleExist = await createQueryBuilder(Schedule)
                    .where('Date(date)>=:cDate', { cDate: moment(data.start).format('YYYY-MM-DD') })
                    .andWhere('Date(date)<:cuDate', { cuDate: moment(data.start).add(1, 'days').format('YYYY-MM-DD') })
                    .andWhere('Time(end)>:cTime', { cTime: moment(data.start).format("HH:mm:ss") })
                    .getOne()

                if(!scheduleExist) {
                    console.log("exist 6")
                    startDate = moment(data.start).add(1, 'days').day(0)
                    days = [[], [], [], [], [], [], [], []]
                    
                    /* Check if is diferent year */
                    if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())
    
                    endDate = moment(startDate).add(8, 'days')
                } else {
                    console.log("no exist 6")
                    startDate = moment(data.start).day(1)
                    days = [[], [], [], [], [], [], []]
                    
                    /* Check if is diferent year */
                    if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

                    endDate = moment(startDate).add(7, 'days')
                }

            } else {
                console.log("6 false")
                startDate = moment(data.start).day(0)
                days = [[], [], [], [], [], [], [], []]
                
                /* Check if is diferent year */
                if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

                endDate = moment(startDate).add(8, 'days')
            }
        } else {
            console.log("0-6 false")
            startDate = moment(data.start).day(1)
            days = [[], [], [], [], [], [], []]
            
            /* Check if is diferent year */
            if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

            endDate = moment(startDate).add(7, 'days')
        }

        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)
        
        /* Get room schedules */
        let room = await getRepository(Room).find({
            relations: ['Schedules', 'Schedules.Instructor', 'Schedules.Booking', 'Schedules.Rooms']
        })
        let roomSchedules
        if(days.length === 7) {
            roomSchedules = await createQueryBuilder(Room)
                .leftJoinAndSelect("Room.Schedules", "Schedules")
                .leftJoinAndSelect("Schedules.Instructor", "Instructor")
                .leftJoinAndSelect("Schedules.Rooms", "Rooms")
                .where('Date(Schedules.date)>=:cDate', { cDate: moment(startDate).format('YYYY-MM-DD') })
                .andWhere('Date(Schedules.date)<:cuDate', { cuDate: moment(endDate).format('YYYY-MM-DD') })
                .orderBy("Schedules.date", "ASC")
                .addOrderBy("Schedules.start", "ASC")
                .getMany()
        } else {
            roomSchedules = await createQueryBuilder(Room)
                .leftJoinAndSelect("Room.Schedules", "Schedules")
                .leftJoinAndSelect("Schedules.Instructor", "Instructor")
                .leftJoinAndSelect("Schedules.Rooms", "Rooms")
                .where('Date(Schedules.date)>=:cDate', { cDate: moment(startDate).format('YYYY-MM-DD') })
                .andWhere('Date(Schedules.date)<:cuDate', { cuDate: moment(endDate).format('YYYY-MM-DD') })
                .orderBy("Schedules.date", "ASC")
                .addOrderBy("Schedules.start", "ASC")
                .getMany()
        }

        if(!room) throw new ErrorResponse(404, 12, 'La sala no existe')
        if(!roomSchedules) throw new ErrorResponse(404, 12, 'La sala no existe')

        /* Is room schedule private */
        for (var i in roomSchedules) {
            for (var j in roomSchedules[i].Schedules) {
                if (roomSchedules[i].Schedules[j].isPrivate) {
                    delete roomSchedules[i].Schedules[j]
                }
            }
        }

        /* Delete fields usless and check disponibility by room schedule */
        let filteredSchedules = []
        for (var i in roomSchedules) {
            const roomSchedule = roomSchedules[i] as Room
            const seats = await createQueryBuilder(Seat)
                .where('isActive =:isActive', { isActive: 1 })
                .getCount()
            
            
            for (var j in roomSchedule.Schedules) {
                const bookings = await createQueryBuilder(Booking)
                    .where('Booking.schedules_id =:scheduleId', { scheduleId: roomSchedule.Schedules[j].id })
                    .getCount()
                
                const available = seats - bookings
                
                let soldout = false
                if (available == 0) soldout = true

                delete roomSchedule.Schedules[j].Instructor.createdAt
                delete roomSchedule.Schedules[j].Instructor.lastname
                delete roomSchedule.Schedules[j].Instructor.description
                delete roomSchedule.Schedules[j].Instructor.profilePicture
                delete roomSchedule.Schedules[j].Instructor.largePicture
                delete roomSchedule.Schedules[j].Instructor.email
                delete roomSchedule.Schedules[j].Instructor.password
                delete roomSchedule.Schedules[j].Instructor.isDeleted
                delete roomSchedule.Schedules[j].Rooms.description
                delete roomSchedule.Schedules[j].Booking

                const clientBookings = await getRepository(Booking).find({
                    where: {
                        Schedule: roomSchedule.Schedules[j],
                        User: client
                    },
                    relations: ["Seat"]
                })

                if (!clientBookings) {
                    filteredSchedules.push({
                        ...roomSchedule.Schedules[j],
                        available: available,
                        occupied: bookings,
                        soldOut: soldout,
                        booking: null
                    })

                } else {
                    filteredSchedules.push({
                        ...roomSchedule.Schedules[j],
                        available: available,
                        occupied: bookings,
                        soldOut: soldout,
                        booking: clientBookings
                    })
                }
            }
        }

        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Separate registers per day */
        var date = moment(startDate).format("YYYY-MM-DD")
        for(var i in days) {
            for(var j in filteredSchedules) {
                const filteredSchedule = filteredSchedules[j]
                const dateRoom = moment(filteredSchedule.date).format("YYYY-MM-DD")

                if(dateRoom === date) {
                    days[i].push(filteredSchedule)
                }
            }

            date = moment(startDate).add((parseInt(i) + 1), 'days').format("YYYY-MM-DD")
        }

        /* let temp = 0
        let flag = false
        if (days.length === 8) {
            for (var i in days[0]) {
                if (moment(data.start).format('YYYY-MM-DD') !== moment(days[0][i].date).format('YYYY-MM-DD')) {
                    if (!flag) {
                        temp = parseInt(i)
                        flag = true
                    }
                    days[7].push(days[0][i])
                }
            }
            days[0].splice(temp, days[7].length)
        } */

        return days
    },

    async getAdminLocationsByWeek(room_id: number, data: AdminLocationSchema, user: User) {
        const client = await getRepository(User).findOne({
            where: {
                id: data.clientId,
                isDeleted: false
            }
        })

        if (!client) throw new ErrorResponse(404, 13, 'Usuario no existe')

        let startDate
        let endDate
        let days
        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Check if is Sunday (0) or Saturday (6) */
        if(moment(data.start).day() === 0 || moment(data.start).day() === 6) {
            console.log("0-6 true")
            /* Check if is Saturday */
            if(moment(data.start).day() === 6) {
                console.log("6 true")
                /* Check if there are classes to take */
                const scheduleExist = await createQueryBuilder(Schedule)
                    .where('Date(date)>=:cDate', { cDate: moment(data.start).format('YYYY-MM-DD') })
                    .andWhere('Date(date)<:cuDate', { cuDate: moment(data.start).add(1, 'days').format('YYYY-MM-DD') })
                    .andWhere('Time(end)>:cTime', { cTime: moment(data.start).format("HH:mm:ss") })
                    .getOne()

                if(!scheduleExist) {
                    console.log("exist 6")
                    startDate = moment(data.start).add(1, 'days').day(0)
                    days = [[], [], [], [], [], [], [], []]
                    
                    /* Check if is diferent year */
                    if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())
    
                    endDate = moment(startDate).add(8, 'days')
                } else {
                    console.log("no exist 6")
                    startDate = moment(data.start).day(1)
                    days = [[], [], [], [], [], [], []]
                    
                    /* Check if is diferent year */
                    if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

                    endDate = moment(startDate).add(7, 'days')
                }

            } else {
                console.log("6 false")
                startDate = moment(data.start).day(0)
                days = [[], [], [], [], [], [], [], []]
                
                /* Check if is diferent year */
                if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

                endDate = moment(startDate).add(8, 'days')
            }
        } else {
            console.log("0-6 false")
            startDate = moment(data.start).day(1)
            days = [[], [], [], [], [], [], []]
            
            /* Check if is diferent year */
            if(moment(startDate).year() !== moment(data.start).year()) startDate = moment(startDate).year(moment(data.start).year())

            endDate = moment(startDate).add(7, 'days')
        }

        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)
        
        /* Get room schedules */
        let room = await getRepository(Room).find({
            relations: ['Schedules', 'Schedules.Instructor', 'Schedules.Booking', 'Schedules.Rooms']
        })
        let roomSchedules
        if(days.length === 7) {
            roomSchedules = await createQueryBuilder(Room)
                .leftJoinAndSelect("Room.Schedules", "Schedules")
                .leftJoinAndSelect("Schedules.Instructor", "Instructor")
                .leftJoinAndSelect("Schedules.Rooms", "Rooms")
                .where('Date(Schedules.date)>=:cDate', { cDate: moment(startDate).format('YYYY-MM-DD') })
                .andWhere('Date(Schedules.date)<:cuDate', { cuDate: moment(endDate).format('YYYY-MM-DD') })
                .orderBy("Schedules.date", "ASC")
                .addOrderBy("Schedules.start", "ASC")
                .getMany()
        } else {
            roomSchedules = await createQueryBuilder(Room)
                .leftJoinAndSelect("Room.Schedules", "Schedules")
                .leftJoinAndSelect("Schedules.Instructor", "Instructor")
                .leftJoinAndSelect("Schedules.Rooms", "Rooms")
                .where('Date(Schedules.date)>=:cDate', { cDate: moment(startDate).format('YYYY-MM-DD') })
                .andWhere('Date(Schedules.date)<:cuDate', { cuDate: moment(endDate).format('YYYY-MM-DD') })
                .orderBy("Schedules.date", "ASC")
                .addOrderBy("Schedules.start", "ASC")
                .getMany()
        }

        if(!room) throw new ErrorResponse(404, 12, 'La sala no existe')
        if(!roomSchedules) throw new ErrorResponse(404, 12, 'La sala no existe')

        /* Is room schedule private */
        if (user) {
            if (!user.isAdmin) {
                for (var i in roomSchedules) {
                    for (var j in roomSchedules[i].Schedules) {
                        if (roomSchedules[i].Schedules[j].isPrivate) {
                            delete roomSchedules[i].Schedules[j]
                        }
                    }
                }
            }
        } else {
            for (var i in roomSchedules) {
                for (var j in roomSchedules[i].Schedules) {
                    if (roomSchedules[i].Schedules[j].isPrivate) {
                        delete roomSchedules[i].Schedules[j]
                    }
                }
            }
        }

        /* Delete fields usless and check disponibility by room schedule */
        let filteredSchedules = []
        for (var i in roomSchedules) {
            const roomSchedule = roomSchedules[i] as Room
            const seats = await createQueryBuilder(Seat)
                .where('isActive =:isActive', { isActive: 1 })
                .getCount()
            
            
            for (var j in roomSchedule.Schedules) {
                const bookings = await createQueryBuilder(Booking)
                    .where('Booking.schedules_id =:scheduleId', { scheduleId: roomSchedule.Schedules[j].id })
                    .getCount()
                
                const available = seats - bookings
                
                let soldout = false
                if (available == 0) soldout = true

                delete roomSchedule.Schedules[j].Instructor.createdAt
                delete roomSchedule.Schedules[j].Instructor.lastname
                delete roomSchedule.Schedules[j].Instructor.description
                delete roomSchedule.Schedules[j].Instructor.profilePicture
                delete roomSchedule.Schedules[j].Instructor.largePicture
                delete roomSchedule.Schedules[j].Instructor.email
                delete roomSchedule.Schedules[j].Instructor.password
                delete roomSchedule.Schedules[j].Instructor.isDeleted
                delete roomSchedule.Schedules[j].Rooms.description
                delete roomSchedule.Schedules[j].Booking

                const clientBookings = await getRepository(Booking).find({
                    where: {
                        Schedule: roomSchedule.Schedules[j],
                        User: client
                    },
                    relations: ["Seat"]
                })

                if (!clientBookings) {
                    filteredSchedules.push({
                        ...roomSchedule.Schedules[j],
                        available: available,
                        occupied: bookings,
                        soldOut: soldout,
                        booking: null
                    })

                } else {
                    filteredSchedules.push({
                        ...roomSchedule.Schedules[j],
                        available: available,
                        occupied: bookings,
                        soldOut: soldout,
                        booking: clientBookings
                    })
                }
            }
        }

        //console.log("\n\nstart:", startDate, "\nend: ", endDate, "\ndays: ", days, "\ncurrentDate: ", data.start)

        /* Separate registers per day */
        var date = moment(startDate).format("YYYY-MM-DD")
        for(var i in days) {
            for(var j in filteredSchedules) {
                const filteredSchedule = filteredSchedules[j]
                const dateRoom = moment(filteredSchedule.date).format("YYYY-MM-DD")

                if(dateRoom === date) {
                    days[i].push(filteredSchedule)
                }
            }

            date = moment(startDate).add((parseInt(i) + 1), 'days').format("YYYY-MM-DD")
        }

        /* let temp = 0
        let flag = false
        if (days.length === 8) {
            for (var i in days[0]) {
                if (moment(data.start).format('YYYY-MM-DD') !== moment(days[0][i].date).format('YYYY-MM-DD')) {
                    if (!flag) {
                        temp = parseInt(i)
                        flag = true
                    }
                    days[7].push(days[0][i])
                }
            }
            days[0].splice(temp, days[7].length)
        } */
        
        return days
    },

    async getSchedules(page: string) {
        const pages = parseInt(page) - 1


        const schedules = await createQueryBuilder(Schedule)
            .select([
                'Schedule',
                'Instructor.name as ´instructoName´',
                'Room.name as ´roomName´'
            ])
            .leftJoinAndSelect("Schedule.Instructor", "Instructor")
            .leftJoinAndSelect("Schedule.Rooms", "Room")
            .skip(pages * 10)
            .take(10)
            .orderBy("Schedule.id", "DESC")
            .getMany()


        const pagesNumber = await createQueryBuilder(Schedule)
            .select([
                'Schedule.id'
            ])
            .leftJoinAndSelect("Schedule.Instructor", "Instructor")
            .leftJoinAndSelect("Schedule.Rooms", "Room")
            .orderBy("Schedule.id", "DESC")
            .getCount()

        let data = []

        const seat = await getRepository(Seat).find({ where: {isActive: 1} })
        let seatlengt = seat.length

        for (var i in schedules) {
            const bookings = await getRepository(Booking).find({
                where: {
                    Schedule: schedules[i]
                }
            })
            let soldout = false
            if (seatlengt == bookings.length) {
                soldout = true
            }

            data.push({
                ...schedules[i],
                soldOut: soldout,
                available: seatlengt - bookings.length
            })
        }

        return { data, pages: pagesNumber }
    },

    async getInstructorSchedules(instructor: Instructor, data: LocationSchema) {
        const schedules = await getRepository(Schedule).find({
            relations: ['Instructor', 'Booking', 'Rooms']
        })

        const filteredSchedules = schedules.filter((schedule: Schedule) => {
            const date = moment(schedule.date)
            const endDate = moment(data.start).add(7, 'days')

            if (date.isSameOrAfter(data.start) && date.isBefore(endDate)) return true
            return false
        })

        let filterSchedules: Schedule[] = []

        for (var i in filteredSchedules) {
            if (filteredSchedules[i].Instructor.id === instructor.id) {
                filterSchedules.push(filteredSchedules[i])
            }
            else if (filteredSchedules[i].Instructor.isDeleted) {
                let names = filteredSchedules[i].Instructor.name.split(" ")
                for (var j in names) {
                    if (names[j].toLowerCase() == instructor.name.toLowerCase()) {
                        filterSchedules.push(filteredSchedules[i])
                    }
                }
            }
        }
        return filterSchedules
    }
}
